-- ============================================================================
-- FAMILY MEAL PLAN — DATABASE
-- ============================================================================
-- Run this whole file once in your Supabase project:
--   Supabase dashboard -> SQL Editor -> New query -> paste -> Run
--
-- It is safe to run more than once. Everything uses "if not exists" or
-- "create or replace", so re-running it will not delete your data.
--
-- Read this file top to bottom — it is basically the blueprint of the app.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. THE TYPES WE INVENTED
-- ----------------------------------------------------------------------------
-- An "enum" is a column that is only allowed to hold one of a fixed list of
-- values. If code ever tries to save role = 'banana', the database refuses.
-- That is a feature: it means a bug becomes a loud error instead of quiet
-- nonsense sitting in your data forever.

do $$ begin
  create type role_t as enum ('owner', 'co_owner', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type appetite_t as enum ('small', 'normal', 'big');
exception when duplicate_object then null; end $$;

do $$ begin
  create type kosher_t as enum ('none', 'style', 'strict');
exception when duplicate_object then null; end $$;

do $$ begin
  create type restriction_t as enum ('allergy', 'dislike', 'love');
exception when duplicate_object then null; end $$;

do $$ begin
  create type severity_t as enum ('mild', 'severe');
exception when duplicate_object then null; end $$;

do $$ begin
  create type shopping_status_t as enum ('pending', 'approved', 'rejected', 'bought');
exception when duplicate_object then null; end $$;

do $$ begin
  create type kashrut_t as enum ('meat', 'dairy', 'pareve');
exception when duplicate_object then null; end $$;

do $$ begin
  create type suggestion_status_t as enum ('pending', 'accepted', 'declined');
exception when duplicate_object then null; end $$;


-- ----------------------------------------------------------------------------
-- 2. PROFILES
-- ----------------------------------------------------------------------------
-- Supabase already stores emails and passwords for us in a private table called
-- auth.users. We are not allowed to add columns to it, so we keep our own row
-- per person here and link to it by id.

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'New user',
  created_at  timestamptz not null default now()
);

-- When somebody signs up, automatically give them a profile row. A "trigger" is
-- a bit of code the database runs by itself when something happens — so we can
-- never end up with a signed-in user who has no profile.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ----------------------------------------------------------------------------
-- 3. FAMILIES
-- ----------------------------------------------------------------------------
-- One row per family. The owner's survey answers live here, because they apply
-- to the whole family — not to one person.

create table if not exists families (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  invite_code         text not null unique,
  owner_id            uuid not null references auth.users(id) on delete restrict,

  -- Survey: shopping + budget
  stores              text[] not null default '{}',
  weekly_budget_cents integer,

  -- Survey: dietary law
  kosher_level        kosher_t not null default 'none',

  -- Survey: the food dials. Stored as JSON like {"gluten":"a_little"}.
  -- JSON is the right choice here because we want to add new dials later
  -- WITHOUT having to change the database every time.
  dials               jsonb not null default '{}'::jsonb,

  dinners_per_week    integer not null default 7 check (dinners_per_week between 1 and 7),
  notes               text,
  created_at          timestamptz not null default now()
);

-- Makes a code like "SUSHI-4821" for family members to join with.
create or replace function make_invite_code()
returns text
language plpgsql
as $$
declare
  words text[] := array['SUSHI','RAMEN','MANGO','BASIL','OLIVE','HONEY','MAPLE','CUMIN','GINGER','SESAME'];
  code text;
begin
  loop
    code := words[1 + floor(random() * array_length(words, 1))::int]
            || '-' || lpad(floor(random() * 10000)::text, 4, '0');
    -- Keep going until we find one nobody is using.
    exit when not exists (select 1 from families where invite_code = code);
  end loop;
  return code;
end;
$$;


-- ----------------------------------------------------------------------------
-- 4. FAMILY MEMBERS
-- ----------------------------------------------------------------------------
-- Who is in the family and what they are allowed to do.
--
-- user_id is nullable on purpose: a parent can add "Ari" to the family before
-- Ari has ever opened the app. Ari's food preferences can be filled in right
-- away, and when he eventually signs up he claims the row with the invite code.

create table if not exists family_members (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  display_name text not null,
  role         role_t not null default 'member',
  appetite     appetite_t not null default 'normal',
  created_at   timestamptz not null default now(),

  -- Nobody can be in the same family twice.
  unique (family_id, user_id)
);

create index if not exists family_members_family_idx on family_members(family_id);
create index if not exists family_members_user_idx on family_members(user_id);


-- ----------------------------------------------------------------------------
-- 5. FOOD RESTRICTIONS  (allergies, dislikes, loves)
-- ----------------------------------------------------------------------------
-- This one table powers the Picky Eaters page.
--
--   allergy - absolute, never serve, safety
--   dislike - "I will not eat this", the AI avoids it
--   love    - "please make this more often", the AI leans towards it
--
-- One table with a `kind` column instead of three near-identical tables. Less
-- code, and adding a fourth kind later is a one-line change.

create table if not exists food_restrictions (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  member_id  uuid not null references family_members(id) on delete cascade,
  kind       restriction_t not null,
  food       text not null,
  severity   severity_t,
  note       text,
  created_at timestamptz not null default now(),

  -- You cannot say "I hate mushrooms" twice.
  unique (member_id, kind, food)
);

create index if not exists food_restrictions_family_idx on food_restrictions(family_id);
create index if not exists food_restrictions_member_idx on food_restrictions(member_id);


-- ----------------------------------------------------------------------------
-- 6. MEAL PLANS + MEALS
-- ----------------------------------------------------------------------------
-- One plan per family per week. week_start is always the Sunday of that week,
-- so everybody in the family is guaranteed to be looking at the same plan.

create table if not exists meal_plans (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families(id) on delete cascade,
  week_start      date not null,
  created_by      uuid references auth.users(id) on delete set null,
  est_total_cents integer,
  notes           text,
  created_at      timestamptz not null default now(),

  unique (family_id, week_start)
);

create table if not exists meals (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references meal_plans(id) on delete cascade,
  day_of_week     integer not null check (day_of_week between 0 and 6),
  title           text not null,
  description     text,
  kashrut         kashrut_t not null default 'pareve',
  cuisine         text,
  protein         text,
  est_cost_cents  integer,
  protein_grams   integer,

  -- A list of {name, quantity, category} objects.
  ingredients     jsonb not null default '[]'::jsonb,
  -- A list of strings, one per step.
  instructions    jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists meals_plan_idx on meals(plan_id);


-- ----------------------------------------------------------------------------
-- 7. SHOPPING LIST
-- ----------------------------------------------------------------------------
-- Anyone in the family can add an item, but it starts as 'pending' and an owner
-- or co-owner has to approve it. Items the AI adds because a meal needs them
-- are approved automatically.

create table if not exists shopping_items (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id) on delete cascade,
  name         text not null,
  quantity     text,
  category     text,
  requested_by uuid not null references family_members(id) on delete cascade,
  status       shopping_status_t not null default 'pending',
  approved_by  uuid references family_members(id) on delete set null,
  from_meal_id uuid references meals(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists shopping_items_family_idx on shopping_items(family_id, status);


-- ----------------------------------------------------------------------------
-- 8. MEAL SUGGESTIONS
-- ----------------------------------------------------------------------------
-- The "suggesting page" for people who are not owners. You ask for a meal, the
-- owner sees it, and the AI is told to try to fit accepted suggestions in.

create table if not exists meal_suggestions (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id) on delete cascade,
  member_id    uuid not null references family_members(id) on delete cascade,
  title        text not null,
  note         text,
  status       suggestion_status_t not null default 'pending',
  created_at   timestamptz not null default now()
);

create index if not exists meal_suggestions_family_idx on meal_suggestions(family_id, status);


-- ============================================================================
-- 9. SECURITY
-- ============================================================================
-- This is the part that actually matters.
--
-- "Row Level Security" means the DATABASE decides who can see which rows —
-- not the app. So even if somebody downloaded our app, pulled our public key
-- out of it and wrote their own program to talk to the database, they still
-- could not read another family's meal plan. The rule is enforced one layer
-- deeper than the attacker is standing.
--
-- Rule of thumb: never trust the app to keep secrets. Make the database do it.
-- ============================================================================

-- Two little helpers. They are `security definer`, which means they run with
-- the database's own permissions and can look at family_members without
-- themselves being blocked by the policies below. Without this, a policy on
-- family_members that queries family_members would loop forever.

create or replace function is_family_member(fid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from family_members
    where family_id = fid and user_id = auth.uid()
  );
$$;

create or replace function my_role(fid uuid)
returns role_t
language sql
security definer
set search_path = public
stable
as $$
  select role from family_members
  where family_id = fid and user_id = auth.uid()
  limit 1;
$$;

create or replace function can_approve(fid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select my_role(fid) in ('owner', 'co_owner');
$$;

-- My own row id inside a family — used to check "did I request this item?".
create or replace function my_member_id(fid uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from family_members
  where family_id = fid and user_id = auth.uid()
  limit 1;
$$;


alter table profiles          enable row level security;
alter table families          enable row level security;
alter table family_members    enable row level security;
alter table food_restrictions enable row level security;
alter table meal_plans        enable row level security;
alter table meals             enable row level security;
alter table shopping_items    enable row level security;
alter table meal_suggestions  enable row level security;

-- Drop first so this file can be re-run safely.
drop policy if exists "read own profile"        on profiles;
drop policy if exists "read family profiles"    on profiles;
drop policy if exists "update own profile"      on profiles;
drop policy if exists "read my families"        on families;
drop policy if exists "create a family"         on families;
drop policy if exists "owners update family"    on families;
drop policy if exists "owner deletes family"    on families;
drop policy if exists "read my family members"  on family_members;
drop policy if exists "join or add members"     on family_members;
drop policy if exists "update members"          on family_members;
drop policy if exists "remove members"          on family_members;
drop policy if exists "read restrictions"       on food_restrictions;
drop policy if exists "write own restrictions"  on food_restrictions;
drop policy if exists "delete own restrictions" on food_restrictions;
drop policy if exists "read plans"              on meal_plans;
drop policy if exists "owners write plans"      on meal_plans;
drop policy if exists "owners delete plans"     on meal_plans;
drop policy if exists "read meals"              on meals;
drop policy if exists "owners write meals"      on meals;
drop policy if exists "owners update meals"     on meals;
drop policy if exists "owners delete meals"     on meals;
drop policy if exists "read shopping"           on shopping_items;
drop policy if exists "add shopping"            on shopping_items;
drop policy if exists "update shopping"         on shopping_items;
drop policy if exists "delete shopping"         on shopping_items;
drop policy if exists "read suggestions"        on meal_suggestions;
drop policy if exists "add suggestions"         on meal_suggestions;
drop policy if exists "update suggestions"      on meal_suggestions;
drop policy if exists "delete suggestions"      on meal_suggestions;


-- PROFILES -------------------------------------------------------------------
create policy "read own profile" on profiles
  for select using (id = auth.uid());

-- You can also see the name of anybody who shares a family with you.
create policy "read family profiles" on profiles
  for select using (
    exists (
      select 1 from family_members mine
      join family_members theirs on theirs.family_id = mine.family_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

create policy "update own profile" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());


-- FAMILIES -------------------------------------------------------------------
create policy "read my families" on families
  for select using (is_family_member(id) or owner_id = auth.uid());

-- You may create a family, but only with yourself as the owner.
create policy "create a family" on families
  for insert with check (owner_id = auth.uid());

create policy "owners update family" on families
  for update using (can_approve(id)) with check (can_approve(id));

create policy "owner deletes family" on families
  for delete using (owner_id = auth.uid());


-- FAMILY MEMBERS -------------------------------------------------------------
create policy "read my family members" on family_members
  for select using (is_family_member(family_id) or user_id = auth.uid());

-- Two legitimate reasons to insert here:
--   1. An owner/co-owner is adding somebody to their family.
--   2. You are claiming your own seat (joining with an invite code).
--   3. The very first row: the person who just created the family.
create policy "join or add members" on family_members
  for insert with check (
    can_approve(family_id)
    or user_id = auth.uid()
    or exists (select 1 from families f where f.id = family_id and f.owner_id = auth.uid())
  );

-- Owners and co-owners can edit anybody; you can always edit yourself.
create policy "update members" on family_members
  for update using (can_approve(family_id) or user_id = auth.uid())
  with check (can_approve(family_id) or user_id = auth.uid());

create policy "remove members" on family_members
  for delete using (
    -- only the true owner can remove people, and never themselves
    exists (select 1 from families f where f.id = family_id and f.owner_id = auth.uid())
    and role <> 'owner'
  );


-- FOOD RESTRICTIONS ----------------------------------------------------------
-- Everyone in the family can READ everyone's allergies and dislikes. That is
-- the whole point of the Picky Eaters page — the cook needs to know.
create policy "read restrictions" on food_restrictions
  for select using (is_family_member(family_id));

-- But you can only ADD things for yourself, unless you are an owner (parents
-- need to be able to fill in food rules for a little kid who has no phone).
create policy "write own restrictions" on food_restrictions
  for insert with check (
    is_family_member(family_id)
    and (member_id = my_member_id(family_id) or can_approve(family_id))
  );

create policy "delete own restrictions" on food_restrictions
  for delete using (
    is_family_member(family_id)
    and (member_id = my_member_id(family_id) or can_approve(family_id))
  );


-- MEAL PLANS + MEALS ---------------------------------------------------------
-- One shared plan; the whole family reads it, owners change it.
create policy "read plans" on meal_plans
  for select using (is_family_member(family_id));

create policy "owners write plans" on meal_plans
  for insert with check (can_approve(family_id));

create policy "owners delete plans" on meal_plans
  for delete using (can_approve(family_id));

create policy "read meals" on meals
  for select using (
    exists (select 1 from meal_plans p where p.id = plan_id and is_family_member(p.family_id))
  );

create policy "owners write meals" on meals
  for insert with check (
    exists (select 1 from meal_plans p where p.id = plan_id and can_approve(p.family_id))
  );

create policy "owners update meals" on meals
  for update using (
    exists (select 1 from meal_plans p where p.id = plan_id and can_approve(p.family_id))
  );

create policy "owners delete meals" on meals
  for delete using (
    exists (select 1 from meal_plans p where p.id = plan_id and can_approve(p.family_id))
  );


-- SHOPPING LIST --------------------------------------------------------------
create policy "read shopping" on shopping_items
  for select using (is_family_member(family_id));

-- Anyone in the family can add. Note the `status = 'pending'` check: a regular
-- member literally cannot insert an already-approved row, so nobody can sneak
-- past the approval step by editing the app.
create policy "add shopping" on shopping_items
  for insert with check (
    is_family_member(family_id)
    and (can_approve(family_id) or (status = 'pending' and requested_by = my_member_id(family_id)))
  );

-- Owners approve/reject anything. Members may tick their own item as bought or
-- change its name/quantity while it is still pending.
create policy "update shopping" on shopping_items
  for update using (
    can_approve(family_id)
    or (requested_by = my_member_id(family_id))
    or (status = 'approved' and is_family_member(family_id))
  )
  with check (
    can_approve(family_id)
    or (requested_by = my_member_id(family_id))
    or (is_family_member(family_id) and status in ('approved', 'bought'))
  );

create policy "delete shopping" on shopping_items
  for delete using (can_approve(family_id) or requested_by = my_member_id(family_id));


-- MEAL SUGGESTIONS -----------------------------------------------------------
create policy "read suggestions" on meal_suggestions
  for select using (is_family_member(family_id));

create policy "add suggestions" on meal_suggestions
  for insert with check (
    is_family_member(family_id) and member_id = my_member_id(family_id)
  );

create policy "update suggestions" on meal_suggestions
  for update using (can_approve(family_id) or member_id = my_member_id(family_id))
  with check (can_approve(family_id) or member_id = my_member_id(family_id));

create policy "delete suggestions" on meal_suggestions
  for delete using (can_approve(family_id) or member_id = my_member_id(family_id));


-- ============================================================================
-- 10. CREATING A FAMILY, SAFELY
-- ============================================================================
-- Creating a family is really two steps: insert the family, then insert
-- yourself as its owner. If the app did that with two separate calls and the
-- phone lost signal in between, you would end up with a family that has no
-- members and no way in — broken forever.
--
-- So we do both inside one database function. A function like this either
-- finishes completely or does nothing at all. That is called a "transaction",
-- and it is why banks use databases.

create or replace function create_family(
  p_name text,
  p_display_name text,
  p_stores text[] default '{}',
  p_budget_cents integer default null,
  p_kosher kosher_t default 'none',
  p_dials jsonb default '{}'::jsonb,
  p_dinners integer default 7,
  p_notes text default null
)
returns families
language plpgsql
security definer
set search_path = public
as $$
declare
  fam families;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a family';
  end if;

  insert into families (name, invite_code, owner_id, stores, weekly_budget_cents,
                        kosher_level, dials, dinners_per_week, notes)
  values (p_name, make_invite_code(), auth.uid(), p_stores, p_budget_cents,
          p_kosher, p_dials, p_dinners, p_notes)
  returning * into fam;

  insert into family_members (family_id, user_id, display_name, role)
  values (fam.id, auth.uid(), p_display_name, 'owner');

  return fam;
end;
$$;


-- Joining a family with an invite code. This has to be a function too, because
-- of a chicken-and-egg problem: to join a family you need to look it up by its
-- code, but the security policy says you can only read families you are
-- already in. This function is allowed to peek, and only tells you the id if
-- your code was correct.
create or replace function join_family(p_code text, p_display_name text)
returns families
language plpgsql
security definer
set search_path = public
as $$
declare
  fam families;
  existing family_members;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to join a family';
  end if;

  select * into fam from families
  where upper(invite_code) = upper(trim(p_code));

  if fam.id is null then
    raise exception 'No family found with that code';
  end if;

  -- Already a member? Just let them back in instead of erroring.
  select * into existing from family_members
  where family_id = fam.id and user_id = auth.uid();

  if existing.id is not null then
    return fam;
  end if;

  -- If a parent already added a placeholder row with this name and nobody has
  -- claimed it, claim that one so the food preferences already typed in for
  -- this person are not lost.
  select * into existing from family_members
  where family_id = fam.id
    and user_id is null
    and lower(display_name) = lower(trim(p_display_name))
  limit 1;

  if existing.id is not null then
    update family_members set user_id = auth.uid() where id = existing.id;
  else
    insert into family_members (family_id, user_id, display_name, role)
    values (fam.id, auth.uid(), p_display_name, 'member');
  end if;

  return fam;
end;
$$;
