/**
 * THE WAITING ROOM
 *
 * You typed a correct invite code, so you are attached to the family — but an
 * owner has not let you in yet, and until they do the database refuses you
 * absolutely everything.
 *
 * This screen exists so that refusal looks like a clear "waiting for a parent"
 * rather than an app full of mysteriously empty pages.
 */

import { useState } from 'react';
import { View } from 'react-native';
import { Body, Button, Card, Screen, Small, Title } from '../../components/ui';
import { useStore } from '../../lib/store';
import { space } from '../../lib/theme';

export default function Waiting() {
  const { me, refresh, signOut } = useStore();
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    // If a parent has approved us since we last looked, refresh() updates the
    // store, awaitingApproval flips to false, and app/index.tsx moves us on.
    await refresh();
    setChecking(false);
  }

  return (
    <Screen>
      <View style={{ height: space.xl }} />
      <Body style={{ fontSize: 52 }}>⏳</Body>
      <Title sub="You are in the queue. A parent needs to let you in.">Waiting to be let in</Title>

      <Card>
        <Body muted>
          You typed the right code{me?.display_name ? `, ${me.display_name}` : ''} — that part
          worked. Now somebody who owns the family has to tap Accept.
        </Body>
        <Small>
          Go and ask them! They will see your request on their Owner tab the next time they open
          the app.
        </Small>
      </Card>

      <Button title={checking ? 'Checking…' : 'Check again'} onPress={check} loading={checking} />

      <Card>
        <Small>
          Until you are let in, the app genuinely cannot show you the meal plan, the shopping list
          or anyone's food rules. That is not the screen being shy — the database itself is
          refusing, which is why joining with a code alone is not enough to see a family's data.
        </Small>
      </Card>

      <Button title="Sign out" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
