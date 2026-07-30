/**
 * The root of the whole app. Everything renders inside this.
 *
 * With Expo Router, the folder structure IS the navigation. A file at
 * app/(tabs)/plan.tsx becomes a screen you can go to. This file is the wrapper
 * that sits above all of them.
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider } from '../lib/store';
import { themes } from '../lib/theme';

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? themes.dark : themes.light;

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: c.bg },
            headerTintColor: c.text,
            headerTitleStyle: { fontWeight: '700' },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: c.bg },
          }}
        >
          {/* headerShown: false means these screens draw their own titles. */}
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="setup" options={{ title: 'Setup needed' }} />
          <Stack.Screen
            name="picky-eaters"
            options={{ title: 'Picky Eaters', presentation: 'card' }}
          />
          <Stack.Screen name="family-settings" options={{ title: 'Family Settings' }} />
        </Stack>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
