/**
 * You are signed in but you are not in a family yet. Two ways forward:
 * start one, or join one somebody else started.
 */

import { router } from 'expo-router';
import { Body, Button, Card, Heading, Screen, Small, Title } from '../../components/ui';
import { useStore } from '../../lib/store';

export default function Start() {
  const { signOut } = useStore();

  return (
    <Screen>
      <Title sub="Are you setting this up for your family, or joining one?">
        Welcome! 🍜
      </Title>

      <Card onPress={() => router.push('/(onboarding)/create')}>
        <Heading>I'm setting it up</Heading>
        <Body muted>
          You'll answer a few questions about how your family shops and eats. You become the owner,
          which means you approve grocery requests and control the food rules.
        </Body>
        <Button title="Create our family" onPress={() => router.push('/(onboarding)/create')} />
      </Card>

      <Card onPress={() => router.push('/(onboarding)/join')}>
        <Heading>I'm joining</Heading>
        <Body muted>
          Somebody in your family already made one. You need the invite code they'll give you.
        </Body>
        <Button
          variant="secondary"
          title="I have a code"
          onPress={() => router.push('/(onboarding)/join')}
        />
      </Card>

      <Button title="Sign out" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
