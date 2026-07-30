/**
 * THE AI MEAL PLANNER
 * ===================
 *
 * This is the brain of the app. It runs on a server, NOT on the phone.
 *
 * Why does that matter? Because calling Claude needs a secret API key, and
 * anything you put in a phone app can be pulled out of it by anyone who
 * downloads it. Apps get taken apart all the time. So the key lives here, on a
 * server nobody else can see, and the app just asks this function politely.
 *
 * Rule to remember for the rest of your programming life:
 *   a secret in an app is not a secret.
 *
 * WHAT THIS FUNCTION DOES
 *   1. Checks who is asking, and that they are allowed to do this
 *   2. Reads the family's rules out of the database
 *   3. Turns those rules into instructions for Claude
 *   4. Asks Claude for a week of meals, in a strict format
 *   5. Double checks Claude's answer against the kosher rules
 *   6. Saves the plan and fills the shopping list
 */

import Anthropic from 'npm:@anthropic-ai/sdk@0.70.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

/* ------------------------------------------------------------------ types */

type DialLevel = 'freely' | 'a_little' | 'banned';

type Family = {
  id: string;
  name: string;
  stores: string[];
  weekly_budget_cents: number | null;
  kosher_level: 'none' | 'style' | 'strict';
  dials: Record<string, DialLevel>;
  dinners_per_week: number;
  notes: string | null;
};

type Member = {
  id: string;
  display_name: string;
  role: 'owner' | 'co_owner' | 'member';
  appetite: 'small' | 'normal' | 'big';
};

type Restriction = {
  member_id: string;
  kind: 'allergy' | 'dislike' | 'love';
  food: string;
};

/* ------------------------------------------------- the shape of the answer */

/**
 * This is the exact shape we demand back from Claude.
 *
 * We are not asking nicely and hoping — we pass this schema to the API and it
 * GUARANTEES the reply matches. No "sometimes it forgets a field", no writing
 * fragile code to dig JSON out of a paragraph of text. It either matches or the
 * request fails.
 *
 * Notes on the rules for these schemas:
 *   - every object needs "additionalProperties": false
 *   - every object needs "required" listing its fields
 *   - things like "minimum" and "maxLength" are NOT supported, so we say what
 *     we want in the prompt instead
 */
const MEAL_PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['week_note', 'meals'],
  properties: {
    week_note: {
      type: 'string',
      description:
        'One or two friendly sentences for the family about this week: the theme, how you kept the cost down, how you handled anyone with allergies.',
    },
    meals: {
      type: 'array',
      description: 'One entry per dinner, in day order.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'day_of_week',
          'title',
          'description',
          'kashrut',
          'cuisine',
          'protein',
          'est_cost_cents',
          'protein_grams',
          'ingredients',
          'instructions',
        ],
        properties: {
          day_of_week: {
            type: 'integer',
            enum: [0, 1, 2, 3, 4, 5, 6],
            description: '0 is Sunday, 6 is Saturday.',
          },
          title: { type: 'string', description: 'The name of the dish.' },
          description: {
            type: 'string',
            description: 'One appetising sentence. What makes this good.',
          },
          kashrut: {
            type: 'string',
            enum: ['meat', 'dairy', 'pareve'],
            description:
              'meat = contains beef/lamb/chicken/turkey. dairy = contains milk/cheese/butter/cream/yogurt. pareve = neither (fish, eggs, vegetables, grains and beans are all pareve).',
          },
          cuisine: { type: 'string', description: 'e.g. Japanese, Thai, Middle Eastern.' },
          protein: { type: 'string', description: 'The main protein, e.g. salmon, chicken thighs, tofu.' },
          est_cost_cents: {
            type: 'integer',
            description: 'Estimated total cost to make this meal for the whole family, in cents.',
          },
          protein_grams: {
            type: 'integer',
            description: 'Roughly how many grams of protein PER PERSON.',
          },
          ingredients: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'quantity', 'category'],
              properties: {
                name: { type: 'string' },
                quantity: { type: 'string', description: 'e.g. "2 lbs", "1 bunch", "3 cloves".' },
                category: {
                  type: 'string',
                  enum: [
                    'Produce',
                    'Meat & Fish',
                    'Dairy',
                    'Bakery',
                    'Pantry',
                    'Frozen',
                    'Spices',
                    'Other',
                  ],
                  description: 'Which part of the shop this is in, so the list is sorted by aisle.',
                },
              },
            },
          },
          instructions: {
            type: 'array',
            description: 'Numbered cooking steps. Clear enough for a confident home cook.',
            items: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

/* -------------------------------------------------------- the safety check */

/**
 * We tell Claude the kosher rules AND we check its answer afterwards.
 *
 * That is not because the AI is bad at this — it is because "we told it the
 * rules" is not the same as "the rules were followed", and this is somebody's
 * dinner table. When the cost of being wrong is high, check the result.
 *
 * Engineers call this "defence in depth": more than one thing has to fail
 * before anything bad actually reaches the user.
 */
const NEVER_KOSHER = [
  'pork', 'bacon', 'ham', 'prosciutto', 'pancetta', 'lard', 'shrimp', 'prawn',
  'crab', 'lobster', 'clam', 'mussel', 'oyster', 'scallop', 'squid', 'calamari',
  'octopus', 'eel', 'unagi', 'catfish', 'shark', 'rabbit', 'venison',
];
const MEAT_WORDS = ['beef', 'chicken', 'turkey', 'lamb', 'veal', 'steak', 'brisket'];
const DAIRY_WORDS = ['milk', 'cheese', 'butter', 'yogurt', 'yoghurt', 'cream', 'parmesan', 'mozzarella', 'feta'];

function kashrutProblems(
  meal: { title: string; ingredients: { name: string }[]; kashrut: string },
  level: Family['kosher_level']
): string[] {
  if (level === 'none') return [];

  const problems: string[] = [];
  const text = [meal.title, ...meal.ingredients.map((i) => i.name)].join(' ').toLowerCase();

  for (const banned of NEVER_KOSHER) {
    // \b is a "word boundary" so "ham" does not match inside "hamburger".
    if (new RegExp(`\\b${banned}s?\\b`).test(text)) {
      problems.push(`contains ${banned}`);
    }
  }

  // Only a fully kosher kitchen separates meat and dairy.
  if (level === 'strict') {
    const hasMeat = MEAT_WORDS.some((w) => text.includes(w));
    const hasDairy = DAIRY_WORDS.some((w) => text.includes(w));
    if (hasMeat && hasDairy) problems.push('mixes meat and dairy');
  }

  return problems;
}

/** Anything a member is allergic to must never appear. No exceptions. */
function allergyProblems(
  meal: { title: string; ingredients: { name: string }[] },
  allergies: { food: string; who: string }[]
): string[] {
  const text = [meal.title, ...meal.ingredients.map((i) => i.name)].join(' ').toLowerCase();
  return allergies
    .filter((a) => text.includes(a.food.toLowerCase()))
    .map((a) => `contains ${a.food}, which ${a.who} is allergic to`);
}

/* ------------------------------------------------------------ the prompt */

function buildPrompt(
  family: Family,
  members: Member[],
  restrictions: Restriction[],
  requests: string[]
): string {
  const nameOf = (id: string) => members.find((m) => m.id === id)?.display_name ?? 'someone';

  const allergies = restrictions.filter((r) => r.kind === 'allergy');
  const dislikes = restrictions.filter((r) => r.kind === 'dislike');
  const loves = restrictions.filter((r) => r.kind === 'love');

  const bigEaters = members.filter((m) => m.appetite === 'big');

  const dials = Object.entries(family.dials ?? {});
  const banned = dials.filter(([, v]) => v === 'banned').map(([k]) => k);
  const limited = dials.filter(([, v]) => v === 'a_little').map(([k]) => k);

  const lines: string[] = [];

  lines.push(`# The ${family.name} family`);
  lines.push(`There are ${members.length} people eating: ${members.map((m) => m.display_name).join(', ')}.`);
  if (bigEaters.length) {
    lines.push(
      `${bigEaters.map((m) => m.display_name).join(' and ')} ${bigEaters.length === 1 ? 'has a big appetite and needs' : 'have big appetites and need'} noticeably more protein and larger portions.`
    );
  }

  lines.push(`\n# Plan exactly ${family.dinners_per_week} dinners`);

  /* ---- hard rules, in order of how badly we must not break them ---- */
  lines.push(`\n# ABSOLUTE RULES — breaking any of these makes the plan useless`);

  if (allergies.length) {
    lines.push(`\n## Allergies (a safety issue, not a preference)`);
    for (const a of allergies) {
      lines.push(`- ${nameOf(a.member_id)} is allergic to ${a.food}. It must not appear in ANY meal, in ANY amount, including as a garnish, a sauce, or a cooking oil.`);
    }
  } else {
    lines.push(`\n## Allergies\nNobody in this family has a recorded allergy.`);
  }

  if (family.kosher_level === 'strict') {
    lines.push(`\n## Kosher (fully kosher kitchen)`);
    lines.push(`- No pork or pork products of any kind.`);
    lines.push(`- No shellfish or seafood without fins and scales — no shrimp, crab, lobster, clams, mussels, oysters, scallops, squid, octopus or eel.`);
    lines.push(`- Fish must have fins and scales. Salmon, tuna, cod, sea bass, halibut, snapper and trout are all fine.`);
    lines.push(`- NEVER combine meat and dairy in the same meal. No cheese on a beef dish, no butter-basted chicken, no cream sauce with lamb.`);
    lines.push(`- Tag every meal correctly as "meat", "dairy" or "pareve".`);
    lines.push(`- If the family likes sushi, that works beautifully — just use salmon, tuna or vegetable rolls instead of shrimp, eel or crab. Imitation crab made from pollock is fine.`);
  } else if (family.kosher_level === 'style') {
    lines.push(`\n## Kosher style`);
    lines.push(`- No pork and no shellfish.`);
    lines.push(`- Meat and dairy in the same meal is fine for this family.`);
  }

  if (banned.length) {
    lines.push(`\n## Completely banned by the parents`);
    for (const b of banned) lines.push(`- ${b.replace(/_/g, ' ')}: never use this at all.`);
  }

  /* ---- softer rules ---- */
  lines.push(`\n# STRONG PREFERENCES`);

  if (limited.length) {
    lines.push(`\n## Use sparingly`);
    for (const l of limited) {
      lines.push(`- ${l.replace(/_/g, ' ')}: at most once or twice across the whole week, in small amounts.`);
    }
  }

  if (dislikes.length) {
    lines.push(`\n## Foods people refuse to eat`);
    for (const d of dislikes) {
      lines.push(`- ${nameOf(d.member_id)} will not eat ${d.food}. Avoid it. If a dish really needs it, leave it out or make it easy to serve on the side.`);
    }
  }

  if (loves.length) {
    lines.push(`\n## Foods people love — lean into these`);
    for (const l of loves) lines.push(`- ${nameOf(l.member_id)} loves ${l.food}.`);
  }

  if (requests.length) {
    lines.push(`\n## Meals the family specifically asked for this week`);
    lines.push(`Fit these in if you can do it without breaking any rule above:`);
    for (const r of requests) lines.push(`- ${r}`);
  }

  /* ---- money and shopping ---- */
  lines.push(`\n# Budget and shopping`);
  if (family.weekly_budget_cents) {
    lines.push(`- Keep the whole week at or under $${(family.weekly_budget_cents / 100).toFixed(2)} total. This is a real constraint, not a suggestion.`);
    lines.push(`- Ways to hit it: build meals around eggs, beans, lentils, tofu, chicken thighs and whole chickens rather than steak and salmon fillets; buy whole vegetables instead of pre-cut; plan two meals that reuse the same ingredient so nothing is bought for a single dish and then wasted.`);
  } else {
    lines.push(`- No budget set, but still be sensible with money.`);
  }
  if (family.stores?.length) {
    lines.push(`- They shop at: ${family.stores.join(', ')}. Only use ingredients they can actually buy there.`);
  }

  /* ---- what makes a good week ---- */
  lines.push(`\n# What a great week looks like`);
  lines.push(`- Genuinely healthy: vegetables in most meals, whole grains over refined, protein at every dinner.`);
  lines.push(`- Varied: do not repeat a protein two nights running, and do not make it chicken five times. Mix cuisines across the week.`);
  lines.push(`- Real food that adults want to eat. Do not write bland "kid food" — this family cooks properly.`);
  lines.push(`- Reasonable on a weeknight. If a dish needs a long braise or marinade, put it on a weekend.`);
  lines.push(`- Recipes should be clear enough for a confident home cook, with real quantities.`);

  lines.push(`\n# Notes from the parents, in their own words`);
  lines.push(family.notes?.trim() ? family.notes : '(nothing added)');

  lines.push(`\nNow build the week.`);

  return lines.join('\n');
}

/* -------------------------------------------------------------- the server */

Deno.serve(async (req) => {
  // Browsers demand this before they will let a web page call us.
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  try {
    const { family_id, week_start } = await req.json();
    if (!family_id || !week_start) {
      return json({ error: 'Need family_id and week_start.' }, 400);
    }

    /* --- 1. who is asking? ------------------------------------------------
     * We build the database connection using the CALLER'S OWN login token,
     * not a master key. That means every database rule we wrote in schema.sql
     * still applies to this function.
     *
     * So we do not need to write "is this person an owner?" here at all — the
     * database refuses the write if they are not. One rule, enforced in one
     * place, impossible to forget. */
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'You must be signed in.' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: 'Could not verify who you are.' }, 401);

    /* --- 2. read the family's rules -------------------------------------- */
    const [famRes, memRes, resRes, sugRes] = await Promise.all([
      supabase.from('families').select('*').eq('id', family_id).single(),
      supabase.from('family_members').select('*').eq('family_id', family_id),
      supabase.from('food_restrictions').select('*').eq('family_id', family_id),
      supabase
        .from('meal_suggestions')
        .select('title, note')
        .eq('family_id', family_id)
        .eq('status', 'accepted'),
    ]);

    if (famRes.error || !famRes.data) {
      return json({ error: 'Could not find that family (or you are not in it).' }, 403);
    }

    const family = famRes.data as Family;
    const members = (memRes.data ?? []) as Member[];
    const restrictions = (resRes.data ?? []) as Restriction[];
    const requests = (sugRes.data ?? []).map((s: any) =>
      s.note ? `${s.title} — ${s.note}` : s.title
    );

    const me = members.find((m) => (m as any).user_id === userData.user.id);
    if (!me || (me.role !== 'owner' && me.role !== 'co_owner')) {
      return json({ error: 'Only a parent can generate the meal plan.' }, 403);
    }

    /* --- 3. ask Claude ---------------------------------------------------- */
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

    const response = await anthropic.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      // Fallbacks: if Claude's safety system ever declines a request, the API
      // quietly retries on another model instead of handing us an error.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [
        'You are a meal planner for one specific family, and you know their rules exactly.',
        '',
        'Order of priority when rules collide:',
        '1. Allergies. Absolute. A meal that contains an allergen is a dangerous failure, not a small mistake.',
        '2. Religious dietary law. Absolute.',
        '3. Foods the parents banned outright.',
        '4. Budget.',
        '5. Foods individual people refuse to eat.',
        '6. Everything else — variety, foods people love, how exciting it is.',
        '',
        'You are cooking for people who cook. Write real recipes with real technique and real quantities. Never dumb food down.',
        'Be honest in your cost estimates rather than optimistic.',
      ].join('\n'),
      messages: [{ role: 'user', content: buildPrompt(family, members, restrictions, requests) }],
      // This is what forces the reply to match our schema exactly.
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: MEAL_PLAN_SCHEMA },
      },
    });

    // Always check this before reading the reply — on a refusal there is no
    // content to read, and blindly grabbing content[0] would crash.
    if (response.stop_reason === 'refusal') {
      return json({ error: 'The AI declined this request. Try adjusting your notes.' }, 422);
    }

    const textBlock = response.content.find((b: any) => b.type === 'text');
    if (!textBlock) return json({ error: 'The AI sent back an empty answer. Try again.' }, 502);

    const plan = JSON.parse((textBlock as any).text) as {
      week_note: string;
      meals: any[];
    };

    /* --- 4. check its work ------------------------------------------------ */
    const allergyList = restrictions
      .filter((r) => r.kind === 'allergy')
      .map((r) => ({
        food: r.food,
        who: members.find((m) => m.id === r.member_id)?.display_name ?? 'someone',
      }));

    const rejected: { title: string; why: string[] }[] = [];
    const safeMeals = plan.meals.filter((meal) => {
      const problems = [
        ...kashrutProblems(meal, family.kosher_level),
        ...allergyProblems(meal, allergyList),
      ];
      if (problems.length) {
        rejected.push({ title: meal.title, why: problems });
        return false;
      }
      return true;
    });

    if (safeMeals.length === 0) {
      return json(
        { error: 'Every suggested meal broke one of your rules. Please try again.', rejected },
        502
      );
    }

    /* --- 5. save it ------------------------------------------------------- */
    const total = safeMeals.reduce((sum, m) => sum + (m.est_cost_cents ?? 0), 0);

    // Replace any existing plan for this week rather than ending up with two.
    await supabase.from('meal_plans').delete().eq('family_id', family_id).eq('week_start', week_start);

    const { data: newPlan, error: planErr } = await supabase
      .from('meal_plans')
      .insert({
        family_id,
        week_start,
        created_by: userData.user.id,
        est_total_cents: total,
        notes: plan.week_note,
      })
      .select()
      .single();

    if (planErr) throw planErr;

    const { data: savedMeals, error: mealErr } = await supabase
      .from('meals')
      .insert(
        safeMeals.map((m) => ({
          plan_id: newPlan.id,
          day_of_week: m.day_of_week,
          title: m.title,
          description: m.description,
          kashrut: m.kashrut,
          cuisine: m.cuisine,
          protein: m.protein,
          est_cost_cents: m.est_cost_cents,
          protein_grams: m.protein_grams,
          ingredients: m.ingredients,
          instructions: m.instructions,
        }))
      )
      .select();

    if (mealErr) throw mealErr;

    /* --- 6. fill the shopping list --------------------------------------- */
    // Two meals both needing garlic should be ONE line on the list, not two.
    const combined = new Map<string, { name: string; quantity: string; category: string; meal_id: string }>();

    savedMeals!.forEach((saved: any, i: number) => {
      for (const ing of safeMeals[i].ingredients ?? []) {
        const key = ing.name.trim().toLowerCase();
        const existing = combined.get(key);
        if (existing) {
          existing.quantity = `${existing.quantity} + ${ing.quantity}`;
        } else {
          combined.set(key, {
            name: ing.name,
            quantity: ing.quantity,
            category: ing.category,
            meal_id: saved.id,
          });
        }
      }
    });

    if (combined.size > 0) {
      await supabase.from('shopping_items').insert(
        [...combined.values()].map((ing) => ({
          family_id,
          name: ing.name,
          quantity: ing.quantity,
          category: ing.category,
          requested_by: me.id,
          // The AI's ingredients are pre-approved — a parent asked for this plan,
          // so making them tick off 40 items one at a time would be silly.
          status: 'approved',
          approved_by: me.id,
          from_meal_id: ing.meal_id,
        }))
      );
    }

    return json({
      ok: true,
      plan_id: newPlan.id,
      meals: savedMeals!.length,
      shopping_items: combined.size,
      est_total_cents: total,
      // If we caught the AI breaking a rule, say so honestly instead of hiding it.
      rejected: rejected.length ? rejected : undefined,
    });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message ?? 'Something went wrong.' }, 500);
  }
});
