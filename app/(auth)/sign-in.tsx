/**
 * Sign in / sign up.
 *
 * One screen that does both, with a toggle. Fewer screens, less code, and
 * people never end up on the wrong one.
 *
 * Errors show up INLINE on this screen rather than in a popup, for two reasons:
 * popups do not work at all in a browser (see lib/alert.ts), and an inline
 * message stays put while you fix the problem instead of disappearing the
 * moment you dismiss it.
 */

import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import {
  Banner,
  Body,
  Button,
  Card,
  Field,
  Screen,
  Small,
  Title,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { space } from '../../lib/theme';

type Note = { tone: 'error' | 'success' | 'info'; title: string; body?: string };

export default function SignIn() {
  const [mode, setMode] = useState<'in' | 'up'>('up');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);

  const isSignUp = mode === 'up';

  async function submit() {
    setNote(null);

    if (!email.trim() || !password) {
      setNote({ tone: 'error', title: 'Please fill in your email and password.' });
      return;
    }
    if (isSignUp && !name.trim()) {
      setNote({ tone: 'error', title: 'What should we call you?' });
      return;
    }
    if (isSignUp && password.length < 8) {
      setNote({
        tone: 'error',
        title: 'Password too short',
        body: 'Use at least 8 characters so your family data stays safe.',
      });
      return;
    }

    setBusy(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          // Picked up by the database trigger that creates your profile row.
          options: { data: { display_name: name.trim() } },
        });
        if (error) throw error;

        // Supabase can be set up to make people confirm their email address
        // before they are allowed in. When it is, sign-up succeeds but hands
        // back NO session — so there is nothing to log in with yet.
        //
        // This used to silently bounce you back to this screen, which looked
        // exactly like the button was broken. Now we say what happened.
        if (!data.session) {
          setNote({
            tone: 'info',
            title: 'Check your email to finish signing up',
            body: `We sent a confirmation link to ${email.trim()}. Click it, then come back and sign in.`,
          });
          setMode('in');
          return;
        }
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
      const raw = String(e?.message ?? '');

      // Translate Supabase's wording into something a person can act on.
      let title = 'That did not work';
      let body = raw || 'Please try again.';

      if (/already registered|already been registered/i.test(raw)) {
        title = 'You already have an account';
        body = 'Switch to "I already have an account" and sign in instead.';
      } else if (/email not confirmed/i.test(raw)) {
        title = 'Confirm your email first';
        body = 'Check your inbox for the confirmation link we sent you.';
      } else if (/invalid login credentials/i.test(raw)) {
        title = 'Wrong email or password';
        body = 'Check both and try again.';
      } else if (/failed to fetch|network/i.test(raw)) {
        title = 'Could not reach the database';
        body = 'Check that your .env file has the right Supabase URL and key.';
      } else if (/relation .* does not exist|schema/i.test(raw)) {
        title = 'The database has no tables yet';
        body = 'Run supabase/schema.sql in the Supabase SQL Editor. See SETUP.md step 2.';
      }

      setNote({ tone: 'error', title, body });
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
        {note ? <Banner tone={note.tone} title={note.title} body={note.body} /> : null}

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
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        <Button
          title={isSignUp ? 'Create my account' : 'Sign in'}
          onPress={submit}
          loading={busy}
        />

        <Button
          variant="ghost"
          title={isSignUp ? 'I already have an account' : 'I need an account'}
          onPress={() => {
            setMode(isSignUp ? 'in' : 'up');
            setNote(null);
          }}
        />
      </Card>

      <Small>
        Your family's food data is stored privately. Only people in your family can see it.
      </Small>
    </Screen>
  );
}
