/**
 * THE PICKY EATERS PAGE  (Leora's idea)
 *
 * Everybody in the family gets a section. In it you put:
 *
 *   🚫 Allergies  - absolute. The AI is never allowed near these.
 *   😖 Won't eat  - foods you hate. The AI avoids them.
 *   😍 Love       - foods you want more of. The AI leans towards them.
 *
 * Everyone can SEE everyone's lists (the cook needs to know!) but you can only
 * EDIT your own — unless you are a parent, because a 4 year old does not have a
 * phone to type their own allergies into.
 *
 * That "read everyone, write only yourself" rule is enforced by the database, not
 * by this screen. See the food_restrictions policies in schema.sql.
 */

import { useState } from 'react';
import { Alert, View } from 'react-native';
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
  Segmented,
  Small,
  Title,
  useTheme,
} from '../components/ui';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { useAsync } from '../lib/use-async';
import { canApprove, type FoodRestriction, type RestrictionKind } from '../lib/types';
import { space } from '../lib/theme';

const KINDS: { value: RestrictionKind; label: string; emoji: string; blurb: string }[] = [
  { value: 'allergy', label: 'Allergic', emoji: '🚫', blurb: 'Never, in any amount. Safety.' },
  { value: 'dislike', label: "Won't eat", emoji: '😖', blurb: 'The planner avoids it.' },
  { value: 'love', label: 'Love it', emoji: '😍', blurb: 'The planner uses it more.' },
];

export default function PickyEaters() {
  const c = useTheme();
  const { family, me, members, role } = useStore();
  const iAmParent = canApprove(role);

  /** Which member's "add" form is currently open. */
  const [openFor, setOpenFor] = useState<string | null>(me?.id ?? null);
  const [food, setFood] = useState('');
  const [kind, setKind] = useState<RestrictionKind>('dislike');
  const [busy, setBusy] = useState(false);

  const { data: rows, loading, reload } = useAsync(async () => {
    if (!family) return [] as FoodRestriction[];
    const { data, error } = await supabase
      .from('food_restrictions')
      .select('*')
      .eq('family_id', family.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as FoodRestriction[];
  }, [family?.id]);

  async function add(memberId: string) {
    const name = food.trim();
    if (!name || !family) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('food_restrictions').insert({
        family_id: family.id,
        member_id: memberId,
        kind,
        food: name,
        severity: kind === 'allergy' ? 'severe' : null,
      });
      if (error) throw error;
      setFood('');
      await reload();
    } catch (e: any) {
      // A duplicate is not really an error worth shouting about.
      if (String(e.message).includes('duplicate')) {
        Alert.alert('Already there', `${name} is already on that list.`);
      } else {
        Alert.alert('Could not add that', e.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(r: FoodRestriction) {
    try {
      const { error } = await supabase.from('food_restrictions').delete().eq('id', r.id);
      if (error) throw error;
      await reload();
    } catch (e: any) {
      Alert.alert('Could not remove that', e.message);
    }
  }

  if (loading) return <Loading label="Loading everyone's food rules…" />;

  const all = rows ?? [];
  const allergyCount = all.filter((r) => r.kind === 'allergy').length;

  return (
    <Screen>
      <Title sub="What everyone will and won't eat. The meal planner has to obey all of it.">
        Picky Eaters
      </Title>

      {allergyCount > 0 ? (
        <Card style={{ backgroundColor: c.dangerSoft, borderColor: c.dangerSoft }}>
          <Row>
            <Body style={{ fontSize: 20 }}>🚫</Body>
            <Body style={{ flex: 1, color: c.danger, fontWeight: '700' }}>
              {allergyCount} {allergyCount === 1 ? 'allergy' : 'allergies'} on file — these are never
              allowed in a meal, no exceptions.
            </Body>
          </Row>
        </Card>
      ) : null}

      {members.map((m) => {
        const mine = m.id === me?.id;
        const canEdit = mine || iAmParent;
        const theirs = all.filter((r) => r.member_id === m.id);
        const isOpen = openFor === m.id;

        const allergies = theirs.filter((r) => r.kind === 'allergy');
        const dislikes = theirs.filter((r) => r.kind === 'dislike');
        const loves = theirs.filter((r) => r.kind === 'love');

        return (
          <Card key={m.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Heading>{m.display_name}</Heading>
                <Small>
                  {mine ? 'You' : m.role === 'member' ? 'Member' : 'Parent'}
                  {theirs.length ? ` · ${theirs.length} rules` : ' · nothing yet'}
                </Small>
              </View>
              {canEdit ? (
                <Chip
                  label={isOpen ? 'Done' : '+ Add'}
                  tone={isOpen ? 'neutral' : 'primary'}
                  onPress={() => setOpenFor(isOpen ? null : m.id)}
                />
              ) : null}
            </Row>

            {allergies.length > 0 ? (
              <View style={{ gap: space.sm }}>
                <Label>🚫 Allergic to</Label>
                <ChipRow>
                  {allergies.map((r) => (
                    <Chip
                      key={r.id}
                      label={r.food}
                      tone="danger"
                      onRemove={canEdit ? () => remove(r) : undefined}
                    />
                  ))}
                </ChipRow>
              </View>
            ) : null}

            {dislikes.length > 0 ? (
              <View style={{ gap: space.sm }}>
                <Label>😖 Will not eat</Label>
                <ChipRow>
                  {dislikes.map((r) => (
                    <Chip
                      key={r.id}
                      label={r.food}
                      tone="warning"
                      onRemove={canEdit ? () => remove(r) : undefined}
                    />
                  ))}
                </ChipRow>
              </View>
            ) : null}

            {loves.length > 0 ? (
              <View style={{ gap: space.sm }}>
                <Label>😍 Loves</Label>
                <ChipRow>
                  {loves.map((r) => (
                    <Chip
                      key={r.id}
                      label={r.food}
                      tone="primary"
                      onRemove={canEdit ? () => remove(r) : undefined}
                    />
                  ))}
                </ChipRow>
              </View>
            ) : null}

            {theirs.length === 0 && !isOpen ? (
              <Small>{mine ? 'Add anything you will not eat.' : 'Nothing added yet.'}</Small>
            ) : null}

            {/* ------------------------------------------------------ add form */}
            {isOpen && canEdit ? (
              <>
                <Divider />
                <Label>What kind of rule?</Label>
                <Segmented
                  options={KINDS.map((k) => ({ value: k.value, label: `${k.emoji} ${k.label}` }))}
                  value={kind}
                  onChange={setKind}
                  tone={(v) => (v === 'allergy' ? 'danger' : v === 'dislike' ? 'warning' : 'primary')}
                />
                <Small>{KINDS.find((k) => k.value === kind)?.blurb}</Small>
                <Row>
                  <View style={{ flex: 1 }}>
                    <Field
                      placeholder={
                        kind === 'allergy'
                          ? 'e.g. Peanuts'
                          : kind === 'dislike'
                            ? 'e.g. Mushrooms'
                            : 'e.g. Salmon'
                      }
                      value={food}
                      onChangeText={setFood}
                      onSubmitEditing={() => add(m.id)}
                      returnKeyType="done"
                    />
                  </View>
                  <Button
                    title="Add"
                    onPress={() => add(m.id)}
                    loading={busy}
                    disabled={!food.trim()}
                  />
                </Row>
              </>
            ) : null}
          </Card>
        );
      })}

      {members.length === 0 ? (
        <Empty emoji="👨‍👩‍👧‍👦" title="No family members yet" body="Add people from the Owner tab." />
      ) : null}

      <Card>
        <Label>Why the three kinds are different</Label>
        <Body muted>
          An allergy is a hard stop — the AI is told it may never use that food, and the app
          double-checks the plan afterwards. A dislike is a strong preference the AI works around. A
          love is a nudge towards food people are actually excited to eat.
        </Body>
      </Card>
    </Screen>
  );
}
