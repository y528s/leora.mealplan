/**
 * THE SETUP QUIZ  (Leora's design)
 *
 * One question per screen, with a progress bar, instead of one long
 * intimidating scroll. You answer, it moves on.
 *
 * How it works: the whole quiz is a LIST of question objects (`QUESTIONS`
 * below), and this screen just renders whichever one you are currently on.
 * So adding a question is adding an entry to that list — you never touch the
 * navigation, the progress bar or the back button. They all read from the list.
 *
 * That is worth noticing as a pattern: describe the *data*, and let one piece
 * of code render it. The alternative — 20 hand-written screens — is 20 places
 * to make a mistake.
 *
 * Personal things (allergies, foods you hate) are NOT here. They belong to each
 * person and live on the Picky Eaters page, because your brother's hatred of
 * mushrooms is not a family-wide rule.
 */

import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import {
  Banner,
  Body,
  Button,
  Card,
  Chip,
  ChipRow,
  Choice,
  Field,
  Progress,
  Row,
  Screen,
  Small,
  Title,
  useTheme,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';
import {
  DIAL_LEVELS,
  FOOD_DIALS,
  KOSHER_LEVELS,
  type DialLevel,
  type DialSettings,
  type KosherLevel,
} from '../../lib/food-rules';
import { space } from '../../lib/theme';

const COMMON_STORES = [
  "Trader Joe's",
  'Costco',
  'Whole Foods',
  'ShopRite',
  'Aldi',
  'Kroger',
  'Walmart',
  'Local kosher market',
  'Asian supermarket',
];

/** Everything the quiz collects, in one object. */
type Answers = {
  familyName: string;
  myName: string;
  stores: string[];
  budget: string;
  dinners: string;
  kosher: KosherLevel;
  dials: DialSettings;
  notes: string;
};

/**
 * One question. `kind` decides which controls get drawn, and `canSkip` says
 * whether the Next button works without an answer.
 */
type Question =
  | { kind: 'text'; id: keyof Answers; title: string; blurb?: string; placeholder: string; required?: boolean; multiline?: boolean; numeric?: boolean }
  | { kind: 'stores'; title: string; blurb?: string }
  | { kind: 'kosher'; title: string; blurb?: string }
  | { kind: 'dial'; dialId: string; title: string; blurb: string }
  | { kind: 'review'; title: string };

const QUESTIONS: Question[] = [
  {
    kind: 'text',
    id: 'familyName',
    title: 'What should we call your family?',
    blurb: 'This shows at the top of the app.',
    placeholder: 'e.g. The Cohens',
    required: true,
  },
  {
    kind: 'text',
    id: 'myName',
    title: 'And what should we call you?',
    blurb: 'What your family actually calls you.',
    placeholder: 'e.g. Mom',
    required: true,
  },
  {
    kind: 'stores',
    title: 'Where do you shop?',
    blurb: 'Pick as many as you like. The AI sticks to things you can actually buy there.',
  },
  {
    kind: 'text',
    id: 'budget',
    title: 'How much do you want to spend on food each week?',
    blurb: 'Optional — but if you set it, the AI works hard to stay under it.',
    placeholder: 'e.g. 200',
    numeric: true,
  },
  {
    kind: 'text',
    id: 'dinners',
    title: 'How many dinners should we plan each week?',
    blurb: 'Some families eat out or have leftovers a couple of nights.',
    placeholder: '7',
    numeric: true,
  },
  {
    kind: 'kosher',
    title: 'Do you keep kosher?',
    blurb: 'The app enforces the real rules, and double checks the AI afterwards.',
  },
  // One screen per food dial, built automatically from the list in
  // lib/food-rules.ts. Add a dial there and a question appears here for free.
  ...FOOD_DIALS.map(
    (d): Question => ({
      kind: 'dial',
      dialId: d.id,
      title: `How much ${d.label.toLowerCase()}?`,
      blurb: d.covers,
    })
  ),
  {
    kind: 'text',
    id: 'notes',
    title: 'Anything else the AI should know?',
    blurb: 'Plain English. This is where the really useful stuff goes.',
    placeholder:
      "e.g. We love Japanese and Thai food. Friday dinner should feel special. One of us lifts weights and needs a lot of protein. Keep costs down with beans and eggs some nights.",
    multiline: true,
  },
  { kind: 'review', title: 'Ready?' },
];

export default function CreateFamily() {
  const c = useTheme();
  const { refresh } = useStore();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customStore, setCustomStore] = useState('');

  const [a, setA] = useState<Answers>({
    familyName: '',
    myName: '',
    stores: [],
    budget: '',
    dinners: '7',
    kosher: 'none',
    dials: {},
    notes: '',
  });

  const q = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;

  function set<K extends keyof Answers>(key: K, value: Answers[K]) {
    setA((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function next() {
    // Only two questions are actually required. Everything else has a sensible
    // default, and forcing people to answer things they do not care about is
    // the fastest way to make them abandon a setup screen.
    if (q.kind === 'text' && q.required && !String(a[q.id]).trim()) {
      setError('This one we do need.');
      return;
    }
    setError(null);
    setStep((s) => Math.min(QUESTIONS.length - 1, s + 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  function setDial(id: string, level: DialLevel) {
    setA((prev) => {
      // "freely" is the default, so rather than storing it we remove the key.
      // Keeps the saved data small and meaningful.
      if (level === 'freely') {
        const { [id]: _drop, ...rest } = prev.dials;
        return { ...prev, dials: rest };
      }
      return { ...prev, dials: { ...prev.dials, [id]: level } };
    });
    // Answering a dial moves you straight on — 12 dials would be tedious if you
    // had to tap an answer and then tap Next every single time.
    setTimeout(() => setStep((s) => Math.min(QUESTIONS.length - 1, s + 1)), 180);
  }

  function toggleStore(name: string) {
    set(
      'stores',
      a.stores.includes(name) ? a.stores.filter((s) => s !== name) : [...a.stores, name]
    );
  }

  function addCustomStore() {
    const name = customStore.trim();
    if (!name) return;
    if (!a.stores.includes(name)) set('stores', [...a.stores, name]);
    setCustomStore('');
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      // Dollars in the box, cents in the database. Math.round stops $150.005
      // from becoming a number nobody asked for.
      const cents = a.budget.trim()
        ? Math.round(parseFloat(a.budget.replace(/[^0-9.]/g, '')) * 100)
        : null;

      const { error: err } = await supabase.rpc('create_family', {
        p_name: a.familyName.trim(),
        p_display_name: a.myName.trim(),
        p_stores: a.stores,
        p_budget_cents: Number.isFinite(cents as number) ? cents : null,
        p_kosher: a.kosher,
        p_dials: a.dials,
        p_dinners: Math.min(7, Math.max(1, parseInt(a.dinners, 10) || 7)),
        p_notes: a.notes.trim() || null,
      });
      if (err) throw err;

      await refresh();
      router.replace('/(tabs)');
    } catch (e: any) {
      const raw = String(e?.message ?? '');
      setError(
        /does not exist|schema/i.test(raw)
          ? 'The database has no tables yet. Run supabase/schema.sql in the Supabase SQL Editor.'
          : raw || 'Something went wrong. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  const bannedCount = Object.values(a.dials).filter((v) => v === 'banned').length;
  const limitedCount = Object.values(a.dials).filter((v) => v === 'a_little').length;

  return (
    <Screen>
      <Progress step={step + 1} total={QUESTIONS.length} />

      <View style={{ gap: space.sm }}>
        <Title sub={'blurb' in q ? q.blurb : undefined}>{q.title}</Title>
      </View>

      {error ? <Banner tone="error" title={error} /> : null}

      {/* ------------------------------------------------------------- a text box */}
      {q.kind === 'text' ? (
        <Card>
          <Field
            placeholder={q.placeholder}
            value={String(a[q.id])}
            onChangeText={(t) => set(q.id, t as any)}
            multiline={q.multiline}
            keyboardType={q.numeric ? 'decimal-pad' : 'default'}
            autoFocus
            onSubmitEditing={q.multiline ? undefined : next}
            returnKeyType="next"
          />
          {!q.required ? <Small>You can leave this blank.</Small> : null}
        </Card>
      ) : null}

      {/* --------------------------------------------------------------- shops */}
      {q.kind === 'stores' ? (
        <Card>
          <ChipRow>
            {COMMON_STORES.map((s) => (
              <Chip
                key={s}
                label={s}
                tone={a.stores.includes(s) ? 'primary' : 'neutral'}
                onPress={() => toggleStore(s)}
              />
            ))}
          </ChipRow>

          {a.stores.filter((s) => !COMMON_STORES.includes(s)).length > 0 ? (
            <ChipRow>
              {a.stores
                .filter((s) => !COMMON_STORES.includes(s))
                .map((s) => (
                  <Chip key={s} label={s} tone="primary" onRemove={() => toggleStore(s)} />
                ))}
            </ChipRow>
          ) : null}

          <Row>
            <View style={{ flex: 1 }}>
              <Field
                placeholder="Somewhere else?"
                value={customStore}
                onChangeText={setCustomStore}
                onSubmitEditing={addCustomStore}
                returnKeyType="done"
              />
            </View>
            <Button variant="secondary" title="Add" onPress={addCustomStore} />
          </Row>
        </Card>
      ) : null}

      {/* -------------------------------------------------------------- kosher */}
      {q.kind === 'kosher' ? (
        <View style={{ gap: space.md }}>
          {KOSHER_LEVELS.map((k) => (
            <Choice
              key={k.value}
              label={k.label}
              blurb={k.blurb}
              selected={a.kosher === k.value}
              onPress={() => {
                set('kosher', k.value);
                setTimeout(next, 180);
              }}
            />
          ))}
        </View>
      ) : null}

      {/* ---------------------------------------------------------- one dial */}
      {q.kind === 'dial' ? (
        <View style={{ gap: space.md }}>
          {DIAL_LEVELS.map((l) => (
            <Choice
              key={l.value}
              label={l.label}
              blurb={l.blurb}
              selected={(a.dials[q.dialId] ?? 'freely') === l.value}
              onPress={() => setDial(q.dialId, l.value)}
            />
          ))}
        </View>
      ) : null}

      {/* -------------------------------------------------------------- review */}
      {q.kind === 'review' ? (
        <Card>
          <Body style={{ fontWeight: '700', fontSize: 18 }}>{a.familyName || 'Your family'}</Body>
          <ChipRow>
            {a.stores.map((s) => (
              <Chip key={s} label={s} />
            ))}
            {a.budget ? <Chip label={`$${a.budget}/week`} tone="primary" /> : null}
            <Chip label={`${a.dinners} dinners`} />
            {a.kosher !== 'none' ? (
              <Chip
                label={a.kosher === 'strict' ? 'Fully kosher' : 'Kosher style'}
                tone="primary"
              />
            ) : null}
            {bannedCount ? <Chip label={`${bannedCount} banned`} tone="danger" /> : null}
            {limitedCount ? <Chip label={`${limitedCount} limited`} tone="warning" /> : null}
          </ChipRow>
          <Small>You can change every one of these later.</Small>
        </Card>
      ) : null}

      {/* ---------------------------------------------------------- navigation */}
      <Row>
        {step > 0 ? (
          <Button variant="secondary" title="← Back" onPress={back} style={{ flex: 1 }} />
        ) : null}
        {isLast ? (
          <Button
            title="Create our family 🎉"
            onPress={create}
            loading={busy}
            style={{ flex: 2 }}
          />
        ) : (
          <Button title="Next →" onPress={next} style={{ flex: 2 }} />
        )}
      </Row>

      {/* Dials and kosher move on by themselves, so offer a way past the ones
          you do not care about without making it the main button. */}
      {q.kind === 'dial' ? (
        <Button variant="ghost" title="Skip — no limit on this" onPress={next} />
      ) : null}
    </Screen>
  );
}
