/**
 * The traffic cop.
 *
 * This screen has no UI of its own. It looks at what we know about you and
 * sends you to the right place:
 *
 *   no database keys yet  -> setup instructions
 *   not signed in         -> sign in
 *   signed in, no family  -> create or join a family
 *   all set               -> the app
 */

import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { Loading } from '../components/ui';
import { useStore } from '../lib/store';
import { isSupabaseConfigured } from '../lib/supabase';

export default function Index() {
  const { loading, session, family, awaitingApproval } = useStore();

  if (!isSupabaseConfigured) return <Redirect href="/setup" />;

  // Do not redirect while we are still checking — otherwise the app would flash
  // the sign-in screen for a moment every time you open it, even when you are
  // already signed in.
  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        <Loading label="Getting your family…" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/sign-in" />;
  // Check this BEFORE the no-family case. Somebody waiting to be approved has
  // no family from the database's point of view, so without this they would be
  // sent back to "create or join" and could join over and over forever.
  if (awaitingApproval) return <Redirect href="/(onboarding)/waiting" />;
  if (!family) return <Redirect href="/(onboarding)/start" />;
  return <Redirect href="/(tabs)" />;
}
