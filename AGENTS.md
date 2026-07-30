# Notes for anyone working on this project

## What it is

A family meal-planning app. Expo (React Native) + Expo Router on the front,
Supabase (Postgres + auth) for data, and a Supabase Edge Function that calls the
Claude API to generate the weekly plan.

## Versions

Expo SDK 57. Read the exact versioned docs at
https://docs.expo.dev/versions/v57.0.0/ before writing any Expo code — the APIs
move between versions.

One SDK 57 gotcha already hit: `Tabs` must be imported from
`expo-router/js-tabs`. Importing it from `expo-router` still works but is
deprecated.

## Rules this project follows

**Security lives in the database, not the app.** Every permission rule is a Row
Level Security policy in `supabase/schema.sql`. Hiding a button in the UI is a
courtesy; the database policy is the actual enforcement. When you add a feature
that writes data, add the policy — do not rely on the screen not offering it.

**The Claude API key never touches the app.** It is a Supabase secret read only
by the Edge Function.

**The AI's output is validated, not trusted.** Kosher rules and allergies go into
the prompt *and* are checked against the returned plan in code. Keep both in
sync: `lib/food-rules.ts` and the copies inside
`supabase/functions/generate-plan/index.ts`.

**Three kinds of food rule, never conflated.** Allergy (absolute, per person),
food dial (three levels, owner-set, family-wide), dislike (per person, soft).
Do not collapse these into one concept.

## Layout

- `app/` — screens (file-based routing)
- `components/ui.tsx` — all shared UI
- `lib/theme.ts` — all colours and spacing; no hardcoded values in screens
- `lib/food-rules.ts` — dials, kosher rules, validation
- `lib/types.ts` — mirrors the database schema; change both together
- `supabase/schema.sql` — tables and security policies
- `supabase/functions/generate-plan/` — the AI, Deno runtime

`supabase/functions` is excluded from the app's tsconfig because it is Deno code
with different globals.

## Before committing

```bash
npx tsc --noEmit
```
