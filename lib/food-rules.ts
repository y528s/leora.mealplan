/**
 * FOOD RULES
 *
 * The app has three different kinds of food rules, and they are NOT the same
 * thing. Keeping them separate is the most important design decision in the
 * whole app, because the AI has to treat them differently:
 *
 *   1. ALLERGY   - set by each person. Absolute. Never appears, ever, in any
 *                  amount. This is a safety rule, not a preference.
 *   2. FOOD DIAL - set by the family owner. Three levels (freely / a little /
 *                  banned). This is how the family eats healthy.
 *   3. DISLIKE   - set by each person on the Picky Eaters page. The AI avoids
 *                  it, but it is not dangerous and can be overridden if there
 *                  is genuinely nothing else to cook.
 *
 * An allergy always beats a dial. A dial always beats a dislike.
 */

/** The three positions of a food dial. */
export type DialLevel = 'freely' | 'a_little' | 'banned';

export const DIAL_LEVELS: {
  value: DialLevel;
  label: string;
  blurb: string;
}[] = [
  {
    value: 'freely',
    label: 'Freely',
    blurb: 'Use it as much as makes sense',
  },
  {
    value: 'a_little',
    label: 'A little',
    blurb: 'Only once or twice a week, small amounts',
  },
  {
    value: 'banned',
    label: 'None at all',
    blurb: 'Never put this in the meal plan',
  },
];

export type FoodDial = {
  /** Stable id — this is what gets saved in the database. Never rename these. */
  id: string;
  label: string;
  /** Shown under the dial so people know what it actually covers. */
  covers: string;
};

/**
 * The dials the owner can set. These lean towards "help us eat healthier"
 * rather than "list every ingredient on earth".
 */
export const FOOD_DIALS: FoodDial[] = [
  { id: 'gluten', label: 'Gluten', covers: 'Bread, pasta, flour, soy sauce, panko' },
  { id: 'dairy', label: 'Dairy', covers: 'Milk, cheese, butter, yogurt, cream' },
  { id: 'red_meat', label: 'Red meat', covers: 'Beef, lamb, veal' },
  { id: 'added_sugar', label: 'Added sugar', covers: 'Sugar in sauces, marinades, desserts' },
  { id: 'fried', label: 'Fried food', covers: 'Deep fried and pan fried in lots of oil' },
  { id: 'processed', label: 'Processed food', covers: 'Deli meat, hot dogs, packaged sauces, instant noodles' },
  { id: 'white_carbs', label: 'White carbs', covers: 'White rice, white bread, white pasta' },
  { id: 'soy', label: 'Soy', covers: 'Tofu, edamame, soy sauce, miso' },
  { id: 'nuts', label: 'Nuts', covers: 'Peanuts, almonds, cashews, sesame' },
  { id: 'eggs', label: 'Eggs', covers: 'Whole eggs, mayo, egg in batter' },
  { id: 'spicy', label: 'Spicy food', covers: 'Chilli, sriracha, gochujang, wasabi' },
  { id: 'raw_fish', label: 'Raw fish', covers: 'Sushi, sashimi, poke, ceviche' },
];

/** A saved set of dials, e.g. { gluten: 'a_little', fried: 'banned' }. */
export type DialSettings = Record<string, DialLevel>;

/** Anything the owner has not touched is treated as "freely". */
export function dialLevel(settings: DialSettings | null | undefined, id: string): DialLevel {
  return settings?.[id] ?? 'freely';
}

/**
 * KOSHER
 *
 * Kosher is a separate question from the dials, because it is not a "how much"
 * dial - it is a set of rules about what food is allowed and which foods are
 * allowed to be cooked and served together.
 */
export type KosherLevel =
  /** Family does not keep kosher. */
  | 'none'
  /** No pork or shellfish, but meat and dairy are not separated. */
  | 'style'
  /** Full: kosher ingredients only, and meat and dairy never mix in a meal. */
  | 'strict';

export const KOSHER_LEVELS: { value: KosherLevel; label: string; blurb: string }[] = [
  {
    value: 'none',
    label: 'We do not keep kosher',
    blurb: 'No kosher rules applied to the meal plan',
  },
  {
    value: 'style',
    label: 'Kosher style',
    blurb: 'No pork and no shellfish, but meat and dairy can be in the same meal',
  },
  {
    value: 'strict',
    label: 'Fully kosher',
    blurb: 'Kosher ingredients only, and meat and dairy are never mixed in one meal',
  },
];

/**
 * Every meal gets tagged as meat, dairy or pareve (neither). This is how the
 * app can promise "we will never put a cheeseburger in your meal plan".
 *
 *   meat   - contains beef, lamb, chicken, turkey
 *   dairy  - contains milk, cheese, butter, yogurt, cream
 *   pareve - neither. Fish, eggs, vegetables, grains, beans are all pareve.
 */
export type KashrutCategory = 'meat' | 'dairy' | 'pareve';

export const KASHRUT_CATEGORIES: {
  value: KashrutCategory;
  label: string;
  emoji: string;
}[] = [
  { value: 'meat', label: 'Meat', emoji: '🍗' },
  { value: 'dairy', label: 'Dairy', emoji: '🧀' },
  { value: 'pareve', label: 'Pareve', emoji: '🥗' },
];

/** Foods that are never kosher, no matter how they are cooked. */
export const NEVER_KOSHER = [
  'pork',
  'bacon',
  'ham',
  'prosciutto',
  'pancetta',
  'lard',
  'shrimp',
  'prawn',
  'crab',
  'lobster',
  'clam',
  'mussel',
  'oyster',
  'scallop',
  'squid',
  'calamari',
  'octopus',
  'eel',
  'unagi',
  'catfish',
  'shark',
  'rabbit',
  'venison',
  'frog',
  'snail',
  'escargot',
];

/**
 * A safety net. The AI is told the kosher rules in its instructions, but we do
 * not just trust it - we check its answer afterwards too. If the AI ever
 * suggests a meal that breaks the rules, we catch it here instead of putting it
 * on the family's table.
 *
 * This is called "defence in depth": tell it the rules AND check the result.
 */
export function findKashrutProblems(meal: {
  title: string;
  ingredients: { name: string }[];
  kashrut: KashrutCategory;
}): string[] {
  const problems: string[] = [];
  const haystack = [meal.title, ...meal.ingredients.map((i) => i.name)]
    .join(' ')
    .toLowerCase();

  for (const banned of NEVER_KOSHER) {
    // \b means "word boundary" so "hamburger" does not match "ham".
    const asWord = new RegExp(`\\b${banned}s?\\b`, 'i');
    if (asWord.test(haystack)) {
      problems.push(`Contains ${banned}, which is never kosher.`);
    }
  }

  const MEAT_WORDS = ['beef', 'chicken', 'turkey', 'lamb', 'veal', 'steak', 'brisket', 'chuck'];
  const DAIRY_WORDS = ['milk', 'cheese', 'butter', 'yogurt', 'yoghurt', 'cream', 'parmesan', 'mozzarella', 'feta'];

  const hasMeat = MEAT_WORDS.some((w) => haystack.includes(w));
  const hasDairy = DAIRY_WORDS.some((w) => haystack.includes(w));

  if (hasMeat && hasDairy) {
    problems.push('This meal mixes meat and dairy, which is not allowed in a fully kosher kitchen.');
  }
  if (meal.kashrut === 'pareve' && (hasMeat || hasDairy)) {
    problems.push('This meal is labelled pareve but contains meat or dairy.');
  }
  if (meal.kashrut === 'meat' && hasDairy) {
    problems.push('This meal is labelled meat but contains dairy.');
  }
  if (meal.kashrut === 'dairy' && hasMeat) {
    problems.push('This meal is labelled dairy but contains meat.');
  }

  return problems;
}
