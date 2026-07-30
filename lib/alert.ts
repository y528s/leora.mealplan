/**
 * TELLING THE USER SOMETHING — on every platform
 *
 * React Native has `Alert.alert()` for popping up a message. It works great on
 * a phone. On the web it does absolutely nothing — react-native-web ships this:
 *
 *     class Alert { static alert() {} }
 *
 * An empty function. So every error message the app tried to show in a browser
 * was silently thrown in the bin, and the app looked like it was ignoring you
 * when actually it was trying hard to explain the problem.
 *
 * That is a nasty class of bug: the code looks correct, it runs without
 * crashing, and it fails by being *silent*. Worth remembering — when something
 * "does nothing", suspect a swallowed message before you suspect broken logic.
 *
 * These two functions do the right thing on both.
 */

import { Alert, Platform } from 'react-native';

/** Show the user a message. Works on phone and in a browser. */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

/**
 * Ask the user to confirm something before we do it — deleting, clearing.
 * Resolves true if they said yes.
 */
export function confirmAction(opts: {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  const { title, message, confirmLabel = 'OK', destructive = false } = opts;

  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  }

  // Alert.alert uses callbacks, but the rest of our code uses await. Wrapping it
  // in a Promise lets us write `if (await confirmAction(...))` instead of
  // nesting everything inside a callback.
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
