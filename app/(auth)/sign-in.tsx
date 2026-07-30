/**
 * Sign in / sign up.
 *
 * One screen that does both, with a toggle. Fewer screens, less code, and
 * people never end up on the wrong one.
 */

import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { Body, Button, Card, Field, Screen, Small, Title, useTheme } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { space } from '../../lib/theme';

export default function SignIn() {
  const c = useTheme();
  const [mode, setMode] = useState<'in' | 'up'>('up');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const isSignUp = mode === 'up';

  async function submit() {
    if (!email.trim() || !password) {
      Alert.alert('Hold on', 'Please fill in your email and password.');
      return;
    }
    if (isSignUp && !name.trim()) {
      Alert.alert('Hold on', 'What should we call you?');
      return;
    }
    if (isSignUp && password.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters so your family data stays safe.');
      return;
    }

    setBusy(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          // This gets picked up by the database trigger that makes your profile.
          options: { data: { display_name: name.trim() } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
      // The store notices the new session by itself and index.tsx routes us on.
      router.replace('/');
    } catch (e: any) {
      Alert.alert('That did not work', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ height: space.xl }} />

      <View style={{ gap: space.sm }}>
        <Body style={{ fontSize: 52 }}>🍜</Body>
        <Title sub="One plan, one shopping list, everybody in the loop.">Family Meal Plan</Title>
      </View>

      <Card>
        {isSignUp ? (
          <Field
            label="Your name"
            placeholder="e.g. Leora"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
          />
        ) : null}

        <Field
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <Field
          label="Password"
          placeholder={isSignUp ? 'At least 8 characters' : 'Your password'}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
        />

        <Button
          title={isSignUp ? 'Create my account' : 'Sign in'}
          onPress={submit}
          loading={busy}
        />

        <Button
          variant="ghost"
          title={isSignUp ? 'I already have an account' : 'I need an account'}
          onPress={() => setMode(isSignUp ? 'in' : 'up')}
        />
      </Card>

      <Small>
        Your family's food data is stored privately. Only people in your family can see it.
      </Small>
    </Screen>
  );
}
