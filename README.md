# 🍜 Family Meal Plan

An app for planning a family's week of dinners, keeping one shared shopping
list, and letting everybody in the family have a say in what they eat.

Built with React Native so it runs as a real app on a real phone — not a website
pretending to be one.

---

## What it does

**One family, one plan.** A parent creates the family and gets an invite code.
Everybody else joins with that code. From then on the whole family is looking at
the same meal plan and the same shopping list.

**The AI actually knows your rules.** It is not a generic recipe generator. Before
it suggests a single meal it reads:

- every person's allergies
- every person's "I will not eat that"
- every person's favourite foods
- the family's food dials
- whether the family keeps kosher, and how strictly
- the weekly budget and which shops they use
- who eats a lot

**Food dials, not on/off switches.** Real families do not eat in binary. For each
kind of food the parents pick one of three levels:

| Level | Means |
|---|---|
| **Freely** | use as much as makes sense |
| **A little** | once or twice a week, small amounts |
| **None at all** | never put this in the plan |

**Three kinds of food rule, treated differently.** This is the most important
design decision in the app:

| Kind | Who sets it | How strict |
|---|---|---|
| 🚫 **Allergy** | each person | absolute — never, in any amount, it is a safety issue |
| 🎛️ **Food dial** | parents only | three levels, see above |
| 😖 **Dislike** | each person | avoided, but not dangerous |

An allergy is not the same thing as hating mushrooms, so the app never treats
them the same.

**Requests that go somewhere.** Anyone can add to the shopping list, but it
arrives as a request and a parent approves it. Anyone can suggest a meal, and if
a parent accepts it, the AI is told to try to fit it in.

---

## The three tabs

**1. Home** — the same tab shows two different screens depending on who you are.

| Owner or co-owner sees | Everybody else sees |
|---|---|
| Generate this week's plan | Suggest a meal |
| Approve grocery requests | See if their ideas were accepted |
| Approve meal ideas | Their own food rules |
| The food dials | Ask for groceries |
| Family members and invite code | |

**2. Meal Plan** — the week. Cost, protein, and meat/dairy/pareve at a glance;
tap a meal for the full recipe. Same for everyone.

**3. Shopping List** — grouped into waiting-for-approval, buy-these, and
in-the-cart. Ingredients from the meal plan land here automatically.

Everyone also has a **Picky Eaters** page, one tap inside the Home tab.

---

## How it is built

```
app/                     every file here is a screen (Expo Router)
  _layout.tsx              wraps the whole app
  index.tsx                decides where to send you
  (auth)/sign-in.tsx       sign up / sign in
  (onboarding)/            create a family, or join one with a code
  (tabs)/                  the three main tabs
  picky-eaters.tsx         everyone's allergies and dislikes
  family-settings.tsx      the food dials (owners only)

components/ui.tsx        buttons, cards, chips — the look of the app
lib/
  theme.ts                 every colour and size in one place
  food-rules.ts            the dials, the kosher rules, the safety checks
  types.ts                 the shape of everything
  supabase.ts              the database connection
  store.tsx                who am I, which family am I in, what can I do

supabase/
  schema.sql               the whole database, including the security rules
  functions/generate-plan/ the AI, running on a server
```

### Why the pieces are where they are

**The database enforces the rules, not the app.** Every "only a parent can do
this" rule lives in `schema.sql` as a Row Level Security policy. Hiding a button
in the app is a courtesy. The database rule is the actual lock — so even if
somebody pulled the app apart and wrote their own program to talk to the
database, they still could not read another family's meal plan or approve their
own grocery request.

> The rule you want to remember: **never trust the app to keep secrets. Make the
> database do it.**

**The AI runs on a server, not on the phone.** Talking to Claude needs a secret
key, and anything inside a phone app can be extracted from it. So the key lives
in a server function and the app just asks it politely.

> **A secret in an app is not a secret.**

**We check the AI's answer.** The planner is told the kosher rules and the
allergies — and then the code checks the reply against those same rules anyway
and throws out anything that breaks them. Telling something the rules is not the
same as the rules being followed, and this is somebody's dinner.

---

## Running it

You need [Node.js](https://nodejs.org) and a free
[Supabase](https://supabase.com) account. Full walkthrough in
**[SETUP.md](./SETUP.md)**.

```bash
npm install
npx expo start
```

Then scan the QR code with your phone. That's it — it's on your phone.

---

## Getting it on the App Store

Everything above you can do yourself. The last step needs a grown-up, because
Apple charges $99/year for a developer account and you have to be 18 to sign one.

```bash
npm install -g eas-cli
eas login
eas build --platform ios      # build it in the cloud
eas submit --platform ios     # send it to Apple
```

Android works the same way with `--platform android` (Google's fee is a one-off
$25).

---

## Ideas for later

- 📸 A photo for each meal
- ⭐ Rate a meal after eating it, so the AI learns what actually went down well
- 🔁 "Make this again" from a past week
- 🧊 Tell it what's already in the fridge so it plans around it
- 🔔 A reminder on the day someone is cooking
- 📊 What the family actually spent vs the budget, over time
- 🥗 Lunches and breakfasts, not just dinners

---

Built by Leora.
