/**
 * The three tabs at the bottom of the app.
 *
 *   1. Home  - owners get controls, everyone else gets a suggesting page
 *   2. Plan  - the week's meals, same for the whole family
 *   3. List  - the shared shopping list
 *
 * Note the import path: in Expo SDK 57, `Tabs` moved to 'expo-router/js-tabs'.
 * Importing it from 'expo-router' still works but is deprecated.
 */

import { Tabs } from 'expo-router/js-tabs';
import { Text } from 'react-native';
import { useTheme } from '../../components/ui';
import { canApprove } from '../../lib/types';
import { useStore } from '../../lib/store';

/** Tab bar icons. Emoji instead of an icon library — no extra dependency. */
function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }} allowFontScaling={false}>
      {emoji}
    </Text>
  );
}

export default function TabsLayout() {
  const c = useTheme();
  const { role } = useStore();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          // The same tab means different things depending on who you are.
          title: canApprove(role) ? 'Owner' : 'Suggest',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji={canApprove(role) ? '🎛️' : '💡'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Meal Plan',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🍽️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: 'Shopping',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
