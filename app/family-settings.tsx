/**
 * FAMILY SETTINGS — owners only.
 *
 * The same answers as the setup survey, editable. Changes save as you make them
 * so there is no "did I press save?" moment.
 */

import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import {
  Body,
  Button,
  Card,
  Chip,
  ChipRow,
  Divider,
  Field,
  Heading,
  Label,
  Row,
  Screen,
  Segmented,
  Small,
  Title,
  useTheme,
} from '../components/ui';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { notify } from '../lib/alert';
import {
  DIAL_LEVELS,
  FOOD_DIALS,
  KOSHER_LEVELS,
  type DialLevel,
  type DialSettings,
  type KosherLevel,
} from '../lib/food-rules';
import { canApprove, formatMoney } from '../lib/types';
import { space } from '../lib/theme';

export default function FamilySettings() {
  const c = useTheme();
  const { family, role, refresh } = useStore();

  const [dials, setDials] = useState<DialSettings>(family?.dials ?? {});
  const [kosher, setKosher] = useState<KosherLevel>(family?.kosher_level ?? 'none');
  const [budget, setBudget] = useState(
    family?.weekly_budget_cents ? (family.weekly_budget_cents / 100).toString() : ''
  );
  const [notes, setNotes] = useState(family?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Keep the form in step with the family if it reloads underneath us.
  useEffect(() => {
    if (!family) return;
    setDials(family.dials ?? {});
    setKosher(family.kosher_level);
    setNotes(family.notes ?? '');
  }, [family?.id]);

  if (!canApprove(role)) {
    return (
      <Screen>
        <Title>Owners only</Title>
        <Body muted>Only a parent can change the family's food rules.</Body>
        <Button title="← Back" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  function setDial(id: string, level: DialLevel) {
    setDirty(true);
    setDials((prev) => {
      if (level === 'freely') {
        const { [id]: _drop, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: level };
    });
  }

  async function save() {
    if (!family) return;
    setSaving(true);
    try {
      const cents = budget.trim()
        ? Math.round(parseFloat(budget.replace(/[^0-9.]/g, '')) * 100)
        : null;

      const { error } = await supabase
        .from('families')
        .update({
          dials,
          kosher_level: kosher,
          weekly_budget_cents: Number.isFinite(cents as number) ? cents : null,
          notes: notes.trim() || null,
        })
        .eq('id', family.id);
      if (error) throw error;

      await refresh();
      setDirty(false);
      notify('Saved ✓', 'The next meal plan will use these rules.');
    } catch (e: any) {
      notify('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  }

  const banned = FOOD_DIALS.filter((d) => dials[d.id] === 'banned');
  const limited = FOOD_DIALS.filter((d) => dials[d.id] === 'a_little');

  return (
    <Screen>
      <Title sub={family?.name}>Food Rules</Title>

      {/* ------------------------------------------------------ what's set now */}
      <Card>
        <Label>Right now</Label>
        <ChipRow>
          {banned.map((d) => (
            <Chip key={d.id} label={`${d.label}: none`} tone="danger" />
          ))}
          {limited.map((d) => (
            <Chip key={d.id} label={`${d.label}: a little`} tone="warning" />
          ))}
          {banned.length === 0 && limited.length === 0 ? (
            <Chip label="Everything allowed freely" />
          ) : null}
        </ChipRow>
      </Card>

      {/* -------------------------------------------------------------- kosher */}
      <Card>
        <Heading>Kosher</Heading>
        <View style={{ gap: space.sm }}>
          {KOSHER_LEVELS.map((k) => {
            const selected = kosher === k.value;
            return (
              <Card
                key={k.value}
                onPress={() => {
                  setKosher(k.value);
                  setDirty(true);
                }}
                style={{
                  borderColor: selected ? c.primary : c.border,
                  backgroundColor: selected ? c.primarySoft : c.surface,
                  padding: space.md,
                  gap: space.xs,
                }}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <Body style={{ fontWeight: '700', flex: 1 }}>{k.label}</Body>
                  {selected ? <Body style={{ color: c.primary, fontWeight: '800' }}>✓</Body> : null}
                </Row>
                <Small>{k.blurb}</Small>
              </Card>
            );
          })}
        </View>
      </Card>

      {/* --------------------------------------------------------- food dials */}
      <Card>
        <Heading>Food dials</Heading>
        <Body muted>Freely, a little, or none at all.</Body>
        <Divider />
        {FOOD_DIALS.map((d, i) => (
          <View key={d.id} style={{ gap: space.sm }}>
            {i > 0 ? <Divider /> : null}
            <View>
              <Body style={{ fontWeight: '700' }}>{d.label}</Body>
              <Small>{d.covers}</Small>
            </View>
            <Segmented
              options={DIAL_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
              value={(dials[d.id] ?? 'freely') as DialLevel}
              onChange={(v) => setDial(d.id, v)}
              tone={(v) => (v === 'banned' ? 'danger' : v === 'a_little' ? 'warning' : 'primary')}
            />
          </View>
        ))}
      </Card>

      {/* -------------------------------------------------------------- budget */}
      <Card>
        <Heading>Budget & notes</Heading>
        <Field
          label="Dollars per week"
          placeholder="e.g. 200"
          value={budget}
          onChangeText={(t) => {
            setBudget(t);
            setDirty(true);
          }}
          keyboardType="decimal-pad"
        />
        <Field
          label="Notes for the AI"
          placeholder="Cuisines you love, who needs extra protein, anything else."
          value={notes}
          onChangeText={(t) => {
            setNotes(t);
            setDirty(true);
          }}
          multiline
        />
      </Card>

      <Button
        title={dirty ? 'Save changes' : 'Saved ✓'}
        onPress={save}
        loading={saving}
        disabled={!dirty}
      />
    </Screen>
  );
}
