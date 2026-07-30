/**
 * The app's design system.
 *
 * Every colour, size and font in the app comes from this one file. That way if
 * we ever want to change the look of the whole app, we change it here once
 * instead of hunting through 20 screens.
 */

export type ThemeColors = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  success: string;
  successSoft: string;
};

const light: ThemeColors = {
  bg: '#FBFAF6',
  surface: '#FFFFFF',
  surfaceAlt: '#F3F2EC',
  border: '#E3E1D7',
  text: '#1A1E19',
  textMuted: '#6C7268',
  primary: '#2E7D5B',
  primaryText: '#FFFFFF',
  primarySoft: '#E4F1EA',
  accent: '#D9703C',
  accentSoft: '#FBEADF',
  danger: '#C0392B',
  dangerSoft: '#FBE6E3',
  warning: '#B07A18',
  warningSoft: '#FBF1DC',
  success: '#2E7D5B',
  successSoft: '#E4F1EA',
};

const dark: ThemeColors = {
  bg: '#12140F',
  surface: '#1C1F19',
  surfaceAlt: '#252921',
  border: '#343A2F',
  text: '#F2F3EE',
  textMuted: '#9AA394',
  primary: '#4FB98A',
  primaryText: '#0B1710',
  primarySoft: '#1E3A2C',
  accent: '#E89B66',
  accentSoft: '#3A2519',
  danger: '#E8746A',
  dangerSoft: '#3A1E1B',
  warning: '#DFAE52',
  warningSoft: '#382D14',
  success: '#4FB98A',
  successSoft: '#1E3A2C',
};

export const themes = { light, dark };

/** Spacing scale — always use these instead of random numbers like 13 or 27. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const font = {
  /** Big screen titles */
  title: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.5 },
  /** Section headings */
  heading: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2 },
  /** Card titles */
  subheading: { fontSize: 16, fontWeight: '700' as const },
  /** Normal reading text */
  body: { fontSize: 15, fontWeight: '500' as const },
  /** Small print, captions, "added by Mom" */
  small: { fontSize: 13, fontWeight: '500' as const },
  /** ALL-CAPS labels above a group of things */
  label: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
} as const;
