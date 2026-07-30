/**
 * TAB 1 — the same slot, two completely different screens.
 *
 * If you are an owner or co-owner you get the control panel: approve requests,
 * set the food dials, generate the week's plan.
 *
 * If you are a regular member you get the suggesting page: ask for a meal, tell
 * the app what you will not eat, request groceries.
 *
 * Both versions are in this one file because they are the same *place* in the
 * app — just seen through different eyes.
 */

import { useState } from 'react';
import { View } from 'react-native';
import { Link, router } from 'expo-router';
import {
  Body,
  Button,
  Card,
  Chip,
  ChipRow,
  Divider,
  Empty,
  Field,
  Heading,
  Label,
  Loading,
  Row,
  Screen,
  Small,
  Title,
  useTheme,
} from '../../components/ui';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { notify } from '../../lib/alert';
import { useAsync } from '../../lib/use-async';
import {
  ROLE_LABEL,
  canApprove,
  formatMoney,
  weekStartFor,
  type FoodRestriction,
  type ShoppingItem,
} from '../../lib/types';
import { FOOD_DIALS, dialLevel } from '../../lib/food-rules';
import { space } from '../../lib/theme';

type Suggestion = {
  id: string;
  member_id: string;
  title: string;
  note: string | null;
  status: 'pending' | 'accepted' | 'declined';
};

export default function HomeTab() {
  const { family, me, members, role, refresh, signOut } = useStore();
  const iCanApprove = canApprove(role);

  const { data, loading, reload } = useAsync(async () => {
    if (!family) return null;
    const [pendingItems, suggestions, restrictions] = await Promise.all([
      supabase
        .from('shopping_items')
        .select('*')
        .eq('family_id', family.id)
        .eq('status', 'pending'),
      supabase
        .from('meal_suggestions')
        .select('*')
        .eq('family_id', family.id)
        .order('created_at', { ascending: false }),
      supabase.from('food_restrictions').select('*').eq('family_id', family.id),
    ]);
    return {
      pendingItems: (pendingItems.data ?? []) as ShoppingItem[],
      suggestions: (suggestions.data ?? []) as Suggestion[],
      restrictions: (restrictions.data ?? []) as FoodRestriction[],
    };
  }, [family?.id]);

  if (loading || !family || !me) return <Loading label="Loading your family…" />;

  return iCanApprove ? (
    <OwnerHome data={data} reload={reload} />
  ) : (
    <MemberHome data={data} reload={reload} />
  );
}

/* ========================================================================== */
/*  OWNER VIEW — the control panel                                            */
/* ========================================================================== */

function OwnerHome({ data, reload }: { data: any; reload: () => Promise<void> }) {
  const c = useTheme();
  const { family, me, members, role, refresh, signOut } = useStore();
  const [generating, setGenerating] = useState(false);

  const pendingItems: ShoppingItem[] = data?.pendingItems ?? [];
  const suggestions: Suggestion[] = data?.suggestions ?? [];
  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');
  const bannedCount = FOOD_DIALS.filter((d) => dialLevel(family!.dials, d.id) === 'banned').length;
  const limitedCount = FOOD_DIALS.filter((d) => dialLevel(family!.dials, d.id) === 'a_little').length;

  function nameFor(id: string) {
    return members.find((m) => m.id === id)?.display_name ?? 'Someone';
  }

  // Everyone who typed the code but has not been let in yet.
  const waitingToJoin = members.filter((m) => m.status === 'pending');

  async function decide(s: Suggestion, status: 'accepted' | 'declined') {
    await supabase.from('meal_suggestions').update({ status }).eq('id', s.id);
    await reload();
  }

  async function decideJoin(m: { id: string; display_name: string }, approve: boolean) {
    // Goes through a database function rather than a plain update, so the
    // "are you actually an owner?" check happens in the database and cannot be
    // skipped by talking to it directly.
    const { error } = await supabase.rpc('decide_join_request', {
      p_member_id: m.id,
      p_approve: approve,
    });
    if (error) {
      notify('Could not do that', error.message);
      return;
    }
    notify(
      approve ? `${m.display_name} is in! 🎉` : `${m.display_name} was turned down`,
      approve ? 'They can see the family now.' : undefined
    );
    await refresh();
    await reload();
  }

  async function approveItem(item: ShoppingItem, status: 'approved' | 'rejected') {
    await supabase
      .from('shopping_items')
      .update({ status, approved_by: me?.id ?? null })
      .eq('id', item.id);
    await reload();
  }

  async function generatePlan() {
    setGenerating(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('generate-plan', {
        body: { family_id: family!.id, week_start: weekStartFor(new Date()) },
      });
      if (error) throw error;
      notify('Plan ready! 🍽️', 'Check the Meal Plan tab.');
      router.push('/(tabs)/plan');
    } catch (e: any) {
      notify(
        'Could not make the plan',
        `${e?.message ?? 'Unknown error'}\n\nIf you have not deployed the AI function yet, see SETUP.md step 5.`
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Screen>
      <Title sub={`${ROLE_LABEL[role!]} of ${family!.name}`}>Control Panel</Title>

      {/* ---------------------------------------------------- make the plan */}
      <Card>
        <Heading>This week's plan</Heading>
        <Body muted>
          The AI reads everyone's allergies, everyone's dislikes, your food dials and your budget,
          then builds a week of dinners and fills the shopping list.
        </Body>
        <Button
          title={generating ? 'Thinking…' : "Make this week's plan ✨"}
          onPress={generatePlan}
          loading={generating}
        />
      </Card>

      {/* ------------------------------------------------ people wanting in */}
      {waitingToJoin.length > 0 ? (
        <View style={{ gap: space.md }}>
          <Heading right={<Chip label={`${waitingToJoin.length}`} tone="danger" />}>
            Wants to join your family
          </Heading>
          {waitingToJoin.map((m) => (
            <Card key={m.id}>
              <View>
                <Body style={{ fontWeight: '700' }}>{m.display_name}</Body>
                <Small>Typed your invite code. They cannot see anything yet.</Small>
              </View>
              <Row>
                <Button title="Let them in" onPress={() => decideJoin(m, true)} style={{ flex: 2 }} />
                <Button
                  title="No"
                  variant="danger"
                  onPress={() => decideJoin(m, false)}
                  style={{ flex: 1 }}
                />
              </Row>
            </Card>
          ))}
        </View>
      ) : null}

      {/* ------------------------------------------------- things to approve */}
      {pendingItems.length > 0 ? (
        <View style={{ gap: space.md }}>
          <Heading right={<Chip label={`${pendingItems.length}`} tone="warning" />}>
            Grocery requests
          </Heading>
          {pendingItems.map((item) => (
            <Card key={item.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Body>
                    {item.name}
                    {item.quantity ? <Small> · {item.quantity}</Small> : null}
                  </Body>
                  <Small>from {nameFor(item.requested_by)}</Small>
                </View>
              </Row>
              <Row>
                <Button title="Approve" onPress={() => approveItem(item, 'approved')} style={{ flex: 1 }} />
                <Button title="No" variant="danger" onPress={() => approveItem(item, 'rejected')} style={{ flex: 1 }} />
              </Row>
            </Card>
          ))}
        </View>
      ) : null}

      {/* ----------------------------------------------- meal ideas from family */}
      {pendingSuggestions.length > 0 ? (
        <View style={{ gap: space.md }}>
          <Heading right={<Chip label={`${pendingSuggestions.length}`} tone="accent" />}>
            Meal ideas
          </Heading>
          {pendingSuggestions.map((s) => (
            <Card key={s.id}>
              <View style={{ gap: 2 }}>
                <Body style={{ fontWeight: '700' }}>{s.title}</Body>
                {s.note ? <Small>"{s.note}"</Small> : null}
                <Small>asked by {nameFor(s.member_id)}</Small>
              </View>
              <Row>
                <Button title="Add to the plan" onPress={() => decide(s, 'accepted')} style={{ flex: 2 }} />
                <Button title="Not this week" variant="secondary" onPress={() => decide(s, 'declined')} style={{ flex: 1 }} />
              </Row>
            </Card>
          ))}
        </View>
      ) : null}

      {/* ------------------------------------------------------------ settings */}
      <Card onPress={() => router.push('/family-settings')}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Heading>Food dials</Heading>
          <Body muted>›</Body>
        </Row>
        <Body muted>
          What your family eats freely, a little of, or not at all.
        </Body>
        <ChipRow>
          {bannedCount > 0 ? <Chip label={`${bannedCount} banned`} tone="danger" /> : null}
          {limitedCount > 0 ? <Chip label={`${limitedCount} limited`} tone="warning" /> : null}
          {bannedCount === 0 && limitedCount === 0 ? <Chip label="Nothing restricted yet" /> : null}
          {family!.kosher_level !== 'none' ? (
            <Chip label={family!.kosher_level === 'strict' ? 'Fully kosher' : 'Kosher style'} tone="primary" />
          ) : null}
          {family!.weekly_budget_cents ? (
            <Chip label={`${formatMoney(family!.weekly_budget_cents)}/week`} />
          ) : null}
        </ChipRow>
      </Card>

      <Card onPress={() => router.push('/picky-eaters')}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Heading>Picky Eaters</Heading>
          <Body muted>›</Body>
        </Row>
        <Body muted>
          Everyone's allergies and the foods they refuse to eat. The AI is never allowed to break
          these.
        </Body>
      </Card>

      {/* -------------------------------------------------------------- family */}
      <View style={{ gap: space.md }}>
        <Heading>Your family</Heading>
        <Card>
          <Label>Invite code</Label>
          <Body style={{ fontSize: 26, fontWeight: '800', letterSpacing: 2, color: c.primary }}>
            {family!.invite_code}
          </Body>
          <Small>Anybody who types this in joins your family.</Small>
        </Card>

        {/* Anyone still waiting is shown in their own section above, so leave
            them out here rather than listing them twice. */}
        {members.filter((m) => m.status !== 'pending').map((m) => (
          <Card key={m.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Body style={{ fontWeight: '700' }}>{m.display_name}</Body>
                <Small>
                  {ROLE_LABEL[m.role]}
                  {m.appetite === 'big' ? ' · big appetite' : m.appetite === 'small' ? ' · small appetite' : ''}
                  {!m.user_id ? ' · has not joined yet' : ''}
                </Small>
              </View>
              {m.id === me?.id ? <Chip label="You" tone="primary" /> : null}
            </Row>
          </Card>
        ))}
      </View>

      <Button title="Sign out" variant="ghost" onPress={signOut} />
    </Screen>
  );
}

/* ========================================================================== */
/*  MEMBER VIEW — the suggesting page                                         */
/* ========================================================================== */

function MemberHome({ data, reload }: { data: any; reload: () => Promise<void> }) {
  const c = useTheme();
  const { family, me, members, signOut } = useStore();
  const [idea, setIdea] = useState('');
  const [why, setWhy] = useState('');
  const [sending, setSending] = useState(false);

  const suggestions: Suggestion[] = (data?.suggestions ?? []).filter(
    (s: Suggestion) => s.member_id === me?.id
  );
  const myRestrictions: FoodRestriction[] = (data?.restrictions ?? []).filter(
    (r: FoodRestriction) => r.member_id === me?.id
  );

  async function suggest() {
    if (!idea.trim() || !family || !me) return;
    setSending(true);
    try {
      const { error } = await supabase.from('meal_suggestions').insert({
        family_id: family.id,
        member_id: me.id,
        title: idea.trim(),
        note: why.trim() || null,
      });
      if (error) throw error;
      setIdea('');
      setWhy('');
      await reload();
      notify('Sent! 🙌', 'Your idea is with the grown-ups.');
    } catch (e: any) {
      notify('Could not send that', e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen>
      <Title sub={`Member of ${family!.name}`}>Hi {me!.display_name} 👋</Title>

      {/* --------------------------------------------------- suggest a meal */}
      <Card>
        <Heading>Suggest a meal</Heading>
        <Body muted>Ask for something you want this week. A parent decides, but they will see it.</Body>
        <Field
          label="What do you want?"
          placeholder="e.g. Salmon teriyaki bowls"
          value={idea}
          onChangeText={setIdea}
        />
        <Field
          label="Why? (optional)"
          placeholder="e.g. we haven't had it in ages"
          value={why}
          onChangeText={setWhy}
          multiline
        />
        <Button title="Send my idea" onPress={suggest} loading={sending} disabled={!idea.trim()} />
      </Card>

      {/* ------------------------------------------------------ my past ideas */}
      {suggestions.length > 0 ? (
        <View style={{ gap: space.md }}>
          <Heading>Your ideas</Heading>
          {suggestions.map((s) => (
            <Card key={s.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Body style={{ flex: 1 }}>{s.title}</Body>
                <Chip
                  label={
                    s.status === 'accepted' ? 'Accepted ✓' : s.status === 'declined' ? 'Not this week' : 'Waiting'
                  }
                  tone={s.status === 'accepted' ? 'primary' : s.status === 'declined' ? 'neutral' : 'warning'}
                />
              </Row>
            </Card>
          ))}
        </View>
      ) : null}

      {/* ------------------------------------------------------------- my food */}
      <Card onPress={() => router.push('/picky-eaters')}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Heading>My food rules</Heading>
          <Body muted>›</Body>
        </Row>
        <Body muted>
          Foods you will not eat, and anything you are allergic to. The meal planner has to respect
          these.
        </Body>
        <ChipRow>
          {myRestrictions.length === 0 ? (
            <Chip label="Nothing added yet" />
          ) : (
            myRestrictions
              .slice(0, 6)
              .map((r) => (
                <Chip
                  key={r.id}
                  label={r.food}
                  tone={r.kind === 'allergy' ? 'danger' : r.kind === 'love' ? 'primary' : 'neutral'}
                />
              ))
          )}
        </ChipRow>
      </Card>

      <Card onPress={() => router.push('/(tabs)/list')}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Heading>Ask for groceries</Heading>
          <Body muted>›</Body>
        </Row>
        <Body muted>Add something to the shopping list. A parent approves it.</Body>
      </Card>

      <Button title="Sign out" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
