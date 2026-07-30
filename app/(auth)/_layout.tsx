/**
 * Layout for the sign-in screens.
 *
 * Without this file, Expo Router makes a default one for us — and that default
 * shows a header bar with the folder name in it, so you get an ugly
 * "(auth)/sign-in" across the top of the screen.
 *
 * These screens draw their own titles, so we turn the header off.
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
