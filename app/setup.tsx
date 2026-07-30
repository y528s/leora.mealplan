/**
 * Shown when the app has no database keys yet.
 *
 * A good app never crashes with a red error screen when something is missing —
 * it tells you exactly what to do next.
 */

import { Body, Card, Heading, Label, Screen, Small, Title } from '../components/ui';
import { useTheme } from '../components/ui';
import { View } from 'react-native';
import { space } from '../lib/theme';

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  const c = useTheme();
  return (
    <Card>
      <Heading>
        {n}. {title}
      </Heading>
      <View style={{ gap: space.sm }}>{children}</View>
    </Card>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  const c = useTheme();
  return (
    <View
      style={{
        backgroundColor: c.surfaceAlt,
        padding: space.md,
        borderRadius: 8,
      }}
    >
      <Body style={{ fontFamily: 'monospace', fontSize: 13 }}>{children}</Body>
    </View>
  );
}

export default function Setup() {
  return (
    <Screen>
      <Title sub="The app is built, it just needs its database keys.">Almost there 🔌</Title>

      <Step n={1} title="Make a Supabase project">
        <Body muted>
          Go to supabase.com, sign up (it is free), and create a new project. Give it any name.
        </Body>
      </Step>

      <Step n={2} title="Create the tables">
        <Body muted>
          In your project, open the SQL Editor, paste in everything from{' '}
          <Body>supabase/schema.sql</Body> and press Run.
        </Body>
      </Step>

      <Step n={3} title="Copy your keys">
        <Body muted>
          In Project Settings → API, copy the Project URL and the anon public key. Then make a file
          called <Body>.env</Body> in the project folder:
        </Body>
        <Code>
          EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co{'\n'}
          EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
        </Code>
        <Small>
          The anon key is safe to put in an app — Row Level Security in the database is what
          actually protects your family's data.
        </Small>
      </Step>

      <Step n={4} title="Restart">
        <Body muted>Stop the server and run it again so it picks up the new file.</Body>
        <Code>npx expo start --clear</Code>
      </Step>

      <Small>Full instructions are in SETUP.md.</Small>
    </Screen>
  );
}
