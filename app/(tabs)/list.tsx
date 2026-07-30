/**
 * THE SHARED SHOPPING LIST
 *
 * Anyone in the family can add something, but it lands as "pending" and an
 * owner or co-owner has to approve it before it counts. That was Leora's rule.
 *
 * Notice we do NOT rely on hiding the approve buttons to enforce that — the
 * database policies in schema.sql refuse the write too. Hiding a button is a
 * courtesy; the database rule is the actual lock.
 */

import { useState } from 'react';
import { Alert, View } from 'react-native';
import {
  Body,
  Button,
  Card,
  Chip,
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
import { useAsync } from '../../lib/use-async';
import { canApprove, type ShoppingItem, type FamilyMember } from '../../lib/types';
import { space } from '../../lib/theme';

export default function ShoppingList() {
  const c = useTheme();
  const { family, me, members, role } = useStore();
  const iCanApprove = canApprove(role);

  const [newItem, setNewItem] = useState('');
  const [qty, setQty] = useState('');
  const [adding, setAdding] = useState(false);

  const { data: items, loading, reload } = useAsync(async () => {
    if (!family) return [] as ShoppingItem[];
    const { data, error } = await supabase
      .from('shopping_items')
      .select('*')
      .eq('family_id', family.id)
      .neq('status', 'rejected')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ShoppingItem[];
  }, [family?.id]);

  function nameFor(memberId: string | null): string {
    if (!memberId) return 'Someone';
    return members.find((m: FamilyMember) => m.id === memberId)?.display_name ?? 'Someone';
  }

  async function addItem() {
    if (!newItem.trim() || !family || !me) return;
    setAdding(true);
    try {
      const { error } = await supabase.from('shopping_items').insert({
        family_id: family.id,
        name: newItem.trim(),
        quantity: qty.trim() || null,
        requested_by: me.id,
        // Owners' own additions skip the queue — they would just approve them
        // anyway, so making them tap twice would be silly.
        status: iCanApprove ? 'approved' : 'pending',
        approved_by: iCanApprove ? me.id : null,
      });
      if (error) throw error;
      setNewItem('');
      setQty('');
      await reload();
    } catch (e: any) {
      Alert.alert('Could not add that', e.message);
    } finally {
      setAdding(false);
    }
  }

  async function setStatus(item: ShoppingItem, status: ShoppingItem['status']) {
    try {
      const { error } = await supabase
        .from('shopping_items')
        .update({ status, approved_by: me?.id ?? null })
        .eq('id', item.id);
      if (error) throw error;
      await reload();
    } catch (e: any) {
      Alert.alert('Could not update that', e.message);
    }
  }

  async function removeItem(item: ShoppingItem) {
    try {
      const { error } = await supabase.from('shopping_items').delete().eq('id', item.id);
      if (error) throw error;
      await reload();
    } catch (e: any) {
      Alert.alert('Could not delete that', e.message);
    }
  }

  if (loading) return <Loading label="Loading the list…" />;

  const pending = (items ?? []).filter((i) => i.status === 'pending');
  const approved = (items ?? []).filter((i) => i.status === 'approved');
  const bought = (items ?? []).filter((i) => i.status === 'bought');

  return (
    <Screen>
      <Title sub={family?.stores?.length ? `Shopping at ${family.stores.join(', ')}` : undefined}>
        Shopping List
      </Title>

      {/* -------------------------------------------------- add something new */}
      <Card>
        <Label>Add an item</Label>
        <Row>
          <View style={{ flex: 3 }}>
            <Field
              placeholder="e.g. Soy sauce"
              value={newItem}
              onChangeText={setNewItem}
              onSubmitEditing={addItem}
              returnKeyType="done"
            />
          </View>
          <View style={{ flex: 2 }}>
            <Field placeholder="How much?" value={qty} onChangeText={setQty} />
          </View>
        </Row>
        <Button
          title={iCanApprove ? 'Add to list' : 'Ask for this'}
          onPress={addItem}
          loading={adding}
          disabled={!newItem.trim()}
        />
        {!iCanApprove ? (
          <Small>A parent will see your request and approve it.</Small>
        ) : null}
      </Card>

      {/* ------------------------------------------------------ waiting for OK */}
      {pending.length > 0 ? (
        <View style={{ gap: space.md }}>
          <Heading right={<Chip label={`${pending.length}`} tone="warning" />}>
            Waiting for approval
          </Heading>
          {pending.map((item) => (
            <Card key={item.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Body>
                    {item.name}
                    {item.quantity ? <Small> · {item.quantity}</Small> : null}
                  </Body>
                  <Small>Asked for by {nameFor(item.requested_by)}</Small>
                </View>
              </Row>
              {iCanApprove ? (
                <Row>
                  <Button
                    title="Approve"
                    onPress={() => setStatus(item, 'approved')}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="No"
                    variant="danger"
                    onPress={() => setStatus(item, 'rejected')}
                    style={{ flex: 1 }}
                  />
                </Row>
              ) : item.requested_by === me?.id ? (
                <Button title="Cancel my request" variant="ghost" onPress={() => removeItem(item)} />
              ) : null}
            </Card>
          ))}
        </View>
      ) : null}

      {/* --------------------------------------------------------- to buy list */}
      <View style={{ gap: space.md }}>
        <Heading right={<Small>{approved.length} to buy</Small>}>Buy these</Heading>

        {approved.length === 0 ? (
          <Empty
            emoji="🛒"
            title="Nothing on the list yet"
            body="Add something above, or generate a meal plan and the ingredients will land here automatically."
          />
        ) : (
          approved.map((item) => (
            <Card key={item.id} onPress={() => setStatus(item, 'bought')}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Body>
                    {item.name}
                    {item.quantity ? <Small> · {item.quantity}</Small> : null}
                  </Body>
                  <Small>
                    {item.from_meal_id ? 'Needed for a meal' : `Added by ${nameFor(item.requested_by)}`}
                  </Small>
                </View>
                <Chip label="Got it" tone="primary" onPress={() => setStatus(item, 'bought')} />
              </Row>
            </Card>
          ))
        )}
      </View>

      {/* ------------------------------------------------------------ in cart */}
      {bought.length > 0 ? (
        <View style={{ gap: space.md }}>
          <Heading
            right={
              iCanApprove ? (
                <Chip
                  label="Clear"
                  onPress={() =>
                    Alert.alert('Clear bought items?', 'This removes them from the list.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Clear',
                        style: 'destructive',
                        onPress: async () => {
                          await supabase
                            .from('shopping_items')
                            .delete()
                            .eq('family_id', family!.id)
                            .eq('status', 'bought');
                          reload();
                        },
                      },
                    ])
                  }
                />
              ) : undefined
            }
          >
            In the cart
          </Heading>
          {bought.map((item) => (
            <Card key={item.id} onPress={() => setStatus(item, 'approved')}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Body muted style={{ textDecorationLine: 'line-through', flex: 1 }}>
                  {item.name}
                </Body>
                <Small>tap to undo</Small>
              </Row>
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
