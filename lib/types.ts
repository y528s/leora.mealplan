/**
 * The shape of everything in the app.
 *
 * These types match the database tables in supabase/schema.sql exactly. When
 * you change one, change the other, or TypeScript will start lying to you.
 */

import type { DialSettings, KashrutCategory, KosherLevel } from './food-rules';

/** What a person is allowed to do inside a family. */
export type Role = 'owner' | 'co_owner' | 'member';

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  co_owner: 'Co-owner',
  member: 'Member',
};

/** Owners and co-owners can approve shopping items and change family settings. */
export function canApprove(role: Role | null | undefined): boolean {
  return role === 'owner' || role === 'co_owner';
}

/** Only the original owner can promote, demote or remove people. */
export function canManageMembers(role: Role | null | undefined): boolean {
  return role === 'owner';
}

export type Profile = {
  id: string;
  display_name: string;
  created_at: string;
};

export type Family = {
  id: string;
  name: string;
  /** Short code family members type in to join, e.g. "SUSHI-4821". */
  invite_code: string;
  owner_id: string;
  /** Stored in cents so we never hit floating point money bugs. */
  weekly_budget_cents: number | null;
  /** Where the family shops, e.g. ["Trader Joe's", "Costco"]. */
  stores: string[];
  kosher_level: KosherLevel;
  /** The owner's food dials — see lib/food-rules.ts. */
  dials: DialSettings;
  /** How many dinners a week the plan should cover. */
  dinners_per_week: number;
  /** Anything else the owner wants the AI to know, in plain English. */
  notes: string | null;
  created_at: string;
};

export type FamilyMember = {
  id: string;
  family_id: string;
  /** Null for a member the owner added who has not signed in yet. */
  user_id: string | null;
  display_name: string;
  role: Role;
  /** Rough guide for portion sizes — a teenager eats more than a toddler. */
  appetite: 'small' | 'normal' | 'big';
  created_at: string;
};

/** One person's feeling about one food. */
export type RestrictionKind = 'allergy' | 'dislike' | 'love';

export type FoodRestriction = {
  id: string;
  family_id: string;
  member_id: string;
  kind: RestrictionKind;
  food: string;
  /** Only meaningful for allergies. */
  severity: 'mild' | 'severe' | null;
  note: string | null;
  created_at: string;
};

export type ShoppingStatus = 'pending' | 'approved' | 'rejected' | 'bought';

export type ShoppingItem = {
  id: string;
  family_id: string;
  name: string;
  quantity: string | null;
  /** Produce, dairy, meat… used to group the list by aisle. */
  category: string | null;
  requested_by: string;
  status: ShoppingStatus;
  approved_by: string | null;
  /** Set when the AI adds an item because a meal needs it. */
  from_meal_id: string | null;
  created_at: string;
};

export type MealPlan = {
  id: string;
  family_id: string;
  /** The Sunday of the week this plan covers, as YYYY-MM-DD. */
  week_start: string;
  created_by: string | null;
  /** Total of every meal's estimated cost. */
  est_total_cents: number | null;
  notes: string | null;
  created_at: string;
};

export type Ingredient = {
  name: string;
  quantity: string;
  category: string;
};

export type Meal = {
  id: string;
  plan_id: string;
  /** 0 = Sunday … 6 = Saturday. */
  day_of_week: number;
  title: string;
  description: string | null;
  kashrut: KashrutCategory;
  /** e.g. "Japanese", "Thai", "Middle Eastern". */
  cuisine: string | null;
  /** Main protein, so we can check the week is not all chicken. */
  protein: string | null;
  est_cost_cents: number | null;
  protein_grams: number | null;
  ingredients: Ingredient[];
  instructions: string[];
  created_at: string;
};

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Turn 1250 into "$12.50". */
export function formatMoney(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Find the Sunday that starts the week containing `date`, formatted YYYY-MM-DD.
 * Every meal plan is keyed to its week's Sunday so everyone in the family is
 * looking at the same week.
 */
export function weekStartFor(date: Date): string {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0); // midday avoids daylight-saving weirdness
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}
