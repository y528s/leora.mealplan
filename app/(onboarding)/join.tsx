/**
 * Joining a family with an invite code.
 *
 * The clever bit is in the database (see join_family in schema.sql): if a parent
 * already added you by name and filled in your allergies before you ever opened
 * the app, typing the same name claims that row instead of making a duplicate.
 */

import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { Body, Button, Card, Field, Screen, Small, Title } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';

export default function JoinFamily() {
  const { refresh } = useStore();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function join() {
    if (!code.trim() || !name.trim()) {
      Alert.alert('Almost', 'We need the code and your name.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc('join_family', {
        p_code: code.trim(),
        p_display_name: name.trim(),
      });
      if (error) throw error;
      await refresh();
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Could not join', e?.message ?? 'Check the code and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title sub="Ask whoever set it up for the invite code.">Join your family</Title>

      <Card>
        <Field
          label="Invite code"
          placeholder="e.g. SUSHI-4821"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Field
          label="Your name"
          placeholder="What your family calls you"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          hint="If a parent already added you, use the same name they used so your food settings carry over."
        />
        <Button title="Join" onPress={join} loading={busy} />
      </Card>

      <Button variant="ghost" title="← Back" onPress={() => router.back()} />
    </Screen>
  );
}
