# Setting it up

Six steps. Steps 1–4 get the app on your phone. Steps 5–6 turn on the AI.

If something goes wrong, jump to [When it breaks](#when-it-breaks) at the bottom —
the errors you are most likely to hit are all listed there with the fix.

---

## 1. Install the packages

```bash
npm install
```

This reads `package.json` and downloads everything the app depends on into a
folder called `node_modules`. That folder is huge and is deliberately not in git —
anyone can rebuild it from `package.json`, so there is no reason to store it.

---

## 2. Make the database

1. Go to [supabase.com](https://supabase.com) and sign up. Free is plenty.
2. Create a new project. Any name. **Save the database password somewhere** — it
   is shown once.
3. Wait about two minutes while it builds.

Now create the tables:

1. In your project, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open `supabase/schema.sql`, copy **all** of it, paste it in
4. Click **Run**

You should see "Success. No rows returned" — that is what success looks like for
a file that creates things rather than fetching things.

Click **Table Editor** and you should see your tables: `families`,
`family_members`, `food_restrictions`, `meal_plans`, `meals`, `shopping_items`,
`meal_suggestions`, `profiles`.

> **Worth reading.** `schema.sql` is commented all the way through and is
> genuinely the blueprint of the whole app. The section on Row Level Security is
> the most important part — it is what stops one family from seeing another
> family's data.

---

## 3. Connect the app to the database

In Supabase, go to **Project Settings** (the gear) → **API**. You need two values:

- **Project URL** — looks like `https://abcdefgh.supabase.co`
- **anon public** key — a very long string starting `eyJ...`

Create a file called `.env` in the project folder:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...your-long-key...
```

> **Two things worth knowing.**
>
> `.env` is in `.gitignore`, so it never gets committed. Get in the habit now:
> keys do not go in git. People have had their credit cards drained by pushing a
> key to a public repo.
>
> But the **anon key is genuinely safe to ship inside the app** — it is designed
> to be public. What protects your family's data is the Row Level Security rules
> in the database, not the secrecy of that key. There is a third key in that
> settings page called `service_role` which is *not* safe and bypasses every
> rule. Never put that one in the app.

---

## 4. Run it

```bash
npx expo start
```

A QR code appears. On your phone:

- **iPhone** — install **Expo Go** from the App Store, then scan the QR with the
  Camera app
- **Android** — install **Expo Go** from Google Play, then scan the QR from
  inside Expo Go

The app loads on your phone. Edit a file on your computer, save it, and watch the
phone update in about a second. That feedback loop is the best part of this kind
of development.

Press `w` in the terminal to also open it in a browser, which is handy for fast
tweaking.

**Try it now:** create an account, create your family, fill in the survey. Add
your family's allergies on the Picky Eaters page. Then hand your phone to someone
and have them join with your invite code — you should see them appear.

Everything works at this point except generating a plan. That is next.

---

## 5. Turn on the AI

The AI needs a Claude API key. Because that key must stay secret, it lives in a
server function rather than in the app.

### Get a key

1. Go to [platform.claude.com](https://platform.claude.com)
2. Sign in and add a little credit (a meal plan costs a few cents to generate)
3. **API Keys** → **Create Key** → copy it

### Install the Supabase CLI

```bash
npm install -g supabase
supabase login
```

### Link this folder to your project

Your project ref is in the Supabase URL — for
`https://abcdefgh.supabase.co` the ref is `abcdefgh`.

```bash
supabase link --project-ref your-project-ref
```

### Give the function the key

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
```

A "secret" here means: the server can read it, nobody else can, and it is not in
your code.

### Deploy the function

```bash
supabase functions deploy generate-plan
```

---

## 6. Generate your first meal plan

Open the app, go to the **Owner** tab, tap **Make this week's plan ✨**.

It thinks for 30–60 seconds — it is planning a whole week around every rule your
family has — then the Meal Plan tab fills in and the ingredients appear on your
shopping list.

🎉

---

## Saving your work to GitHub

Do this often. Every commit is a save point you can come back to.

```bash
git add .
git commit -m "Add the picky eater page"
git push
```

A good commit message says *what changed and why*, not "stuff" or "fixed it".
Six months from now the only person reading it is you, and you will not remember.

---

## When it breaks

Real programming is mostly this. Errors are information, not failure.

**"Almost there 🔌" screen instead of the app**
Your `.env` is missing or misspelled. Check the variable names match exactly —
they must start with `EXPO_PUBLIC_`. Then restart with `npx expo start --clear`.

**Changed `.env` but nothing happened**
Environment variables are read once at startup. Stop the server (`Ctrl+C`) and
run `npx expo start --clear`.

**"relation ... does not exist"**
The tables were not created. Re-run `supabase/schema.sql` in the SQL Editor.

**"new row violates row-level security policy"**
The database is refusing the write on purpose — usually because you are trying to
do an owner-only thing while signed in as a member. That is the security working.
Check what role you actually have on the Owner tab.

**"Could not make the plan"**
Work through it in order:
1. Did you deploy? `supabase functions deploy generate-plan`
2. Is the key set? `supabase secrets list` (it shows names, not values)
3. Do you have credit on your Claude account?
4. Read the actual error: `supabase functions logs generate-plan`

**Phone cannot load the app**
Phone and computer must be on the same wifi. If they are, try
`npx expo start --tunnel`, which routes around fussy networks.

**Something is broken and you have no idea why**
```bash
rm -rf node_modules
npm install
npx expo start --clear
```
This is the programmer's equivalent of turning it off and on again, and it works
more often than it has any right to.

---

## Reading your own code

When you want to understand or change something, here is where to look:

| To change… | Open |
|---|---|
| Colours, fonts, spacing | `lib/theme.ts` |
| Which food dials exist | `lib/food-rules.ts` |
| What the AI is told | `supabase/functions/generate-plan/index.ts`, `buildPrompt` |
| The kosher safety checks | `lib/food-rules.ts` and the same in the function |
| Who is allowed to do what | `supabase/schema.sql`, the SECURITY section |
| A screen's layout | the matching file in `app/` |
| Buttons, cards, chips | `components/ui.tsx` |

Two things to keep in mind as you change it:

**Adding a food dial** is a one-line change in `FOOD_DIALS` — the survey, the
settings screen and the AI prompt all read from that list, so they all update
themselves. That is not an accident; it is what "one source of truth" buys you.

**Changing the database** means changing `lib/types.ts` too, or TypeScript will
start telling you comfortable lies about what shape your data is.
