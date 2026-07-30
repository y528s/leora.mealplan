/**
 * Layout for the "create or join a family" screens.
 *
 * Same reason as app/(auth)/_layout.tsx — without this, Expo Router's default
 * layout puts a header bar reading "(onboarding)/create" at the top of the
 * survey. These screens have their own titles.
 */

import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
