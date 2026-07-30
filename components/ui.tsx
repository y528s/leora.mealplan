/**
 * The app's reusable building blocks.
 *
 * Instead of writing styles on every screen, screens import these. It keeps the
 * whole app looking like one app, and it means a screen file is about *what* it
 * shows, not *how it looks*.
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { font, radius, space, themes, type ThemeColors } from '../lib/theme';

/** Grab the right palette for whether the phone is in light or dark mode. */
export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? themes.dark : themes.light;
}

/* ------------------------------------------------------------------ layout */

export function Screen({
  children,
  scroll = true,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const inner = (
    <View style={[{ padding: space.lg, gap: space.lg, flexGrow: 1 }, style]}>{children}</View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: space.xxl * 2 }}
          keyboardShouldPersistTaps="handled"
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[font.title, { color: c.text }]}>{children}</Text>
      {sub ? <Text style={[font.body, { color: c.textMuted }]}>{sub}</Text> : null}
    </View>
  );
}

export function Heading({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const c = useTheme();
  return (
    <View style={styles.rowBetween}>
      <Text style={[font.heading, { color: c.text }]}>{children}</Text>
      {right}
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  const c = useTheme();
  return <Text style={[font.label, { color: c.textMuted }]}>{children}</Text>;
}

export function Body({
  children,
  muted,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const c = useTheme();
  return (
    <Text style={[font.body, { color: muted ? c.textMuted : c.text }, style]}>{children}</Text>
  );
}

export function Small({ children, muted = true }: { children: React.ReactNode; muted?: boolean }) {
  const c = useTheme();
  return <Text style={[font.small, { color: muted ? c.textMuted : c.text }]}>{children}</Text>;
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const c = useTheme();
  const body = (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderRadius: radius.lg,
          padding: space.lg,
          gap: space.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {body}
    </Pressable>
  );
}

export function Divider() {
  const c = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: c.border }} />;
}

export function Row({
  children,
  style,
  gap = space.sm,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

/* ------------------------------------------------------------------ inputs */

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const off = disabled || loading;

  const look: Record<string, { bg: string; fg: string; border: string }> = {
    primary: { bg: c.primary, fg: c.primaryText, border: c.primary },
    secondary: { bg: c.surface, fg: c.text, border: c.border },
    ghost: { bg: 'transparent', fg: c.primary, border: 'transparent' },
    danger: { bg: c.dangerSoft, fg: c.danger, border: c.dangerSoft },
  };
  const l = look[variant];

  return (
    <Pressable
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        {
          backgroundColor: l.bg,
          borderColor: l.border,
          borderWidth: 2,
          borderRadius: radius.md,
          paddingVertical: 14,
          paddingHorizontal: space.lg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: off ? 0.45 : pressed ? 0.8 : 1,
          minHeight: 50,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={l.fg} />
      ) : (
        <Text style={[font.subheading, { color: l.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  ...props
}: React.ComponentProps<typeof TextInput> & { label?: string; hint?: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        placeholderTextColor={c.textMuted}
        {...props}
        style={[
          font.body,
          {
            backgroundColor: c.surface,
            borderColor: c.border,
            borderWidth: 2,
            borderRadius: radius.md,
            paddingHorizontal: space.md,
            paddingVertical: 14,
            color: c.text,
            minHeight: 50,
          },
          props.multiline ? { minHeight: 90, textAlignVertical: 'top' } : null,
          props.style,
        ]}
      />
      {hint ? <Small>{hint}</Small> : null}
    </View>
  );
}

/** A little rounded tag. Used for allergies, cuisines, meat/dairy labels. */
export function Chip({
  label,
  tone = 'neutral',
  onPress,
  onRemove,
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'danger' | 'warning' | 'accent';
  onPress?: () => void;
  onRemove?: () => void;
}) {
  const c = useTheme();
  const tones = {
    neutral: { bg: c.surfaceAlt, fg: c.textMuted },
    primary: { bg: c.primarySoft, fg: c.primary },
    danger: { bg: c.dangerSoft, fg: c.danger },
    warning: { bg: c.warningSoft, fg: c.warning },
    accent: { bg: c.accentSoft, fg: c.accent },
  } as const;
  const t = tones[tone];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: t.bg,
        borderRadius: radius.pill,
        paddingVertical: 7,
        paddingHorizontal: space.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        opacity: pressed && (onPress || onRemove) ? 0.7 : 1,
      })}
    >
      <Text style={[font.small, { color: t.fg, fontWeight: '700' }]}>{label}</Text>
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={10}>
          <Text style={{ color: t.fg, fontSize: 16, fontWeight: '700', lineHeight: 16 }}>×</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/** Horizontal wrap of chips. */
export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{children}</View>
  );
}

/**
 * A segmented picker — the control behind the food dials.
 * Three options side by side, one selected.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  tone,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** Optional per-option colour, e.g. red for "banned". */
  tone?: (v: T) => 'primary' | 'warning' | 'danger';
}) {
  const c = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: c.surfaceAlt,
        borderRadius: radius.md,
        padding: 3,
        gap: 3,
      }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        const toneKey = tone?.(o.value) ?? 'primary';
        const selBg =
          toneKey === 'danger' ? c.danger : toneKey === 'warning' ? c.warning : c.primary;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 10,
              borderRadius: radius.sm,
              alignItems: 'center',
              backgroundColor: selected ? selBg : 'transparent',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              style={[
                font.small,
                {
                  color: selected ? '#FFFFFF' : c.textMuted,
                  fontWeight: '700',
                },
              ]}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * An inline message, shown right in the screen rather than as a popup.
 *
 * Better than a popup for form errors: it stays on screen while you fix the
 * problem, instead of vanishing the moment you tap OK.
 */
export function Banner({
  tone,
  title,
  body,
}: {
  tone: 'error' | 'success' | 'info';
  title: string;
  body?: string;
}) {
  const c = useTheme();
  const looks = {
    error: { bg: c.dangerSoft, fg: c.danger, emoji: '⚠️' },
    success: { bg: c.successSoft, fg: c.success, emoji: '✓' },
    info: { bg: c.warningSoft, fg: c.warning, emoji: '📬' },
  } as const;
  const l = looks[tone];

  return (
    <View
      style={{
        backgroundColor: l.bg,
        borderRadius: radius.md,
        padding: space.md,
        flexDirection: 'row',
        gap: space.sm,
        alignItems: 'flex-start',
      }}
    >
      <Text style={{ fontSize: 16 }}>{l.emoji}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[font.small, { color: l.fg, fontWeight: '700' }]}>{title}</Text>
        {body ? <Text style={[font.small, { color: l.fg }]}>{body}</Text> : null}
      </View>
    </View>
  );
}

/** Shown when a list is empty, so the screen never looks broken. */
export function Empty({ emoji, title, body }: { emoji: string; title: string; body?: string }) {
  const c = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxl, gap: space.sm }}>
      <Text style={{ fontSize: 44 }}>{emoji}</Text>
      <Text style={[font.subheading, { color: c.text, textAlign: 'center' }]}>{title}</Text>
      {body ? (
        <Text style={[font.small, { color: c.textMuted, textAlign: 'center', maxWidth: 280 }]}>
          {body}
        </Text>
      ) : null}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const c = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingVertical: space.xxl }}>
      <ActivityIndicator color={c.primary} size="large" />
      {label ? <Small>{label}</Small> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
});
