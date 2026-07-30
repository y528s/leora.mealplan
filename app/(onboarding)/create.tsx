/**
 * THE SURVEY
 *
 * The owner answers this once when they set the family up. Everything here
 * applies to the whole family — where you shop, what you spend, dietary law, and
 * the food dials.
 *
 * Personal things (allergies, foods you hate) are NOT here. Those belong to each
 * person and live on the Picky Eaters page, because your brother's hatred of
 * mushrooms is not a family-wide rule.
 *
 * It is one long scroll on purpose. A 6-step wizard for 6 questions is worse:
 * you cannot see what you already answered, and you cannot go back easily.
 */

import { useState } from 'react';
import { Alert, View } from 'react-native';
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

/** Stores we offer as one-tap chips. You can still type your own. */
const COMMON_STORES = [
  'Trader Joe\'s',
  'Costco',
  'Whole Foods',
  'ShopRite',
  'Aldi',
  'Kroger',
  'Walmart',
  'Local kosher market',
  'Asian supermarket',
];

export default function CreateFamily() {
  const c = useTheme();
  const { session, refresh } = useStore();

  const [familyName, setFamilyName] = useState('');
  const [myName, setMyName] = useState('');
  const [stores, setStores] = useState<string[]>([]);
  const [customStore, setCustomStore] = useState('');
  const [budget, setBudget] = useState('');
  const [kosher, setKosher] = useState<KosherLevel>('none');
  const [dials, setDials] = useState<DialSettings>({});
  const [dinners, setDinners] = useState('7');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  function toggleStore(name: string) {
    setStores((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
  }

  function addCustomStore() {
    const name = customStore.trim();
    if (!name) return;
    if (!stores.includes(name)) setStores((prev) => [...prev, name]);
    setCustomStore('');
  }

  function setDial(id: string, level: DialLevel) {
    setDials((prev) => {
      // "freely" is the default, so instead of storing it we remove the key.
      // Keeps the saved data small and meaningful.
      if (level === 'freely') {
        const { [id]: _drop, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: level };
    });
  }

  async function create() {
    if (!familyName.trim()) {
      Alert.alert('Almost', 'What should we call your family?');
      return;
    }
    if (!myName.trim()) {
      Alert.alert('Almost', 'What should we call you?');
      return;
    }

    setBusy(true);
    try {
      // Dollars in the box, cents in the database. Math.round stops $150.005
      // from turning into a weird number.
      const budgetCents = budget.trim()
        ? Math.round(parseFloat(budget.replace(/[^0-9.]/g, '')) * 100)
        : null;

      const { error } = await supabase.rpc('create_family', {
        p_name: familyName.trim(),
        p_display_name: myName.trim(),
        p_stores: stores,
        p_budget_cents: Number.isFinite(budgetCents as number) ? budgetCents : null,
        p_kosher: kosher,
        p_dials: dials,
        p_dinners: Math.min(7, Math.max(1, parseInt(dinners, 10) || 7)),
        p_notes: notes.trim() || null,
      });
      if (error) throw error;

      await refresh();
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Could not create your family', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title sub="This takes about two minutes. You can change all of it later.">
        Set up your family
      </Title>

      {/* ------------------------------------------------------------ basics */}
      <Card>
        <Heading>The basics</Heading>
        <Field
          label="Family name"
          placeholder="e.g. The Cohens"
          value={familyName}
          onChangeText={setFamilyName}
        />
        <Field
          label="Your name"
          placeholder="What your family calls you"
          value={myName}
          onChangeText={setMyName}
        />
      </Card>

      {/* ------------------------------------------------------------ shopping */}
      <Card>
        <Heading>Where do you shop?</Heading>
        <Body muted>
          The AI keeps to things you can actually buy at these stores.
        </Body>
        <ChipRow>
          {COMMON_STORES.map((s) => (
            <Chip
              key={s}
              label={s}
              tone={stores.includes(s) ? 'primary' : 'neutral'}
              onPress={() => toggleStore(s)}
            />
          ))}
        </ChipRow>

        {stores.filter((s) => !COMMON_STORES.includes(s)).length > 0 ? (
          <ChipRow>
            {stores
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

      {/* -------------------------------------------------------------- budget */}
      <Card>
        <Heading>Weekly food budget</Heading>
        <Body muted>
          Optional, but if you set it the AI tries hard to stay under it and shows you the running
          total.
        </Body>
        <Field
          label="Dollars per week"
          placeholder="e.g. 200"
          value={budget}
          onChangeText={setBudget}
          keyboardType="decimal-pad"
        />
        <Field
          label="Dinners to plan each week"
          placeholder="7"
          value={dinners}
          onChangeText={setDinners}
          keyboardType="number-pad"
          hint="Some families eat out or have leftovers a couple of nights."
        />
      </Card>

      {/* -------------------------------------------------------------- kosher */}
      <Card>
        <Heading>Do you keep kosher?</Heading>
        <Body muted>
          This is not just a label — the app enforces the real rules, and double checks the AI's
          answer afterwards.
        </Body>
        <View style={{ gap: space.sm }}>
          {KOSHER_LEVELS.map((k) => {
            const selected = kosher === k.value;
            return (
              <Card
                key={k.value}
                onPress={() => setKosher(k.value)}
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
        <Body muted>
          For each food: have it freely, only a little, or none at all. This is how the app keeps
          your meals healthy. Only you can change these.
        </Body>
        <Divider />

        {FOOD_DIALS.map((d, i) => {
          const level = (dials[d.id] ?? 'freely') as DialLevel;
          return (
            <View key={d.id} style={{ gap: space.sm }}>
              {i > 0 ? <Divider /> : null}
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '700' }}>{d.label}</Body>
                  <Small>{d.covers}</Small>
                </View>
              </Row>
              <Segmented
                options={DIAL_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
                value={level}
                onChange={(v) => setDial(d.id, v)}
                tone={(v) => (v === 'banned' ? 'danger' : v === 'a_little' ? 'warning' : 'primary')}
              />
            </View>
          );
        })}
      </Card>

      {/* --------------------------------------------------------------- notes */}
      <Card>
        <Heading>Anything else?</Heading>
        <Body muted>
          Written in plain English, and passed straight to the AI. This is where the useful stuff
          goes.
        </Body>
        <Field
          placeholder="e.g. We love Japanese and Thai food. Friday night dinner should feel special. One of us lifts weights and needs a lot of protein. Please keep cost down with beans and eggs a couple of nights."
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </Card>

      <Button title="Create our family 🎉" onPress={create} loading={busy} />
      <Small>You can change every single one of these answers later.</Small>
    </Screen>
  );
}
