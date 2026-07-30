/**
 * THE FORK IN THE ROAD
 *
 * You are signed in but not in a family yet, so there are exactly two things
 * you can possibly want. Two choices, nothing else on the screen.
 *
 * You only ever see this once: as soon as you belong to a family, the router
 * (app/index.tsx) sends you straight to the app and never comes back here.
 */

import { router } from 'expo-router';
import { View } from 'react-native';
import { Body, Card, Choice, Screen, Small, Title, Button, useTheme } from '../../components/ui';
import { useStore } from '../../lib/store';
import { space } from '../../lib/theme';

export default function Start() {
  const c = useTheme();
  const { signOut } = useStore();

  return (
    <Screen>
      <View style={{ height: space.lg }} />
      <Body style={{ fontSize: 48 }}>🍜</Body>
      <Title sub="Two ways in. Which one are you?">Welcome!</Title>

      <View style={{ gap: space.lg }}>
        <Choice
          label="① Create a family"
          blurb="Nobody has set this up yet and you are doing it. You answer a short quiz about how your family shops and eats, and you become the owner — you approve who joins, and you set the food rules."
          onPress={() => router.push('/(onboarding)/create')}
        />

        <Choice
          label="② Join a family"
          blurb="Somebody already made one and gave you an invite code. You type the code, then a parent has to let you in before you can see anything."
          onPress={() => router.push('/(onboarding)/join')}
        />
      </View>

      <Card>
        <Small>
          Not sure? If you are the parent doing the food shopping, you want ①. If somebody handed
          you a code like SUSHI-4821, you want ②.
        </Small>
      </Card>

      <Button title="Sign out" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
