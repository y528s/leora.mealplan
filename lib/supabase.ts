/**
 * The connection to our database.
 *
 * Supabase gives us three things for free: a real Postgres database, user
 * sign-in, and live updates (so when your brother adds ketchup to the shopping
 * list, it appears on your phone without you refreshing).
 *
 * The two values below come from your Supabase project settings and go in a
 * file called `.env` which is NEVER committed to git. See SETUP.md.
 */

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * True once both values are filled in. The app checks this on startup and shows
 * friendly setup instructions instead of crashing with a scary red error.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * If the keys are missing we still create a client pointed at a dummy URL, so
 * that importing this file never throws. Nothing will work until the real keys
 * are set, but the app will load and tell you what to do.
 */
export const supabase = createClient(url ?? 'https://placeholder.supabase.co', anonKey ?? 'placeholder', {
  auth: {
    // Keep people signed in between app launches.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Mobile apps do not have a URL bar, so there is no session in the URL.
    detectSessionInUrl: false,
  },
});
