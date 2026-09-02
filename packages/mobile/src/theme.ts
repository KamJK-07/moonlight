import type { AccentTheme, ThemeMode } from '@moonlight/core';

/**
 * Same token system as the desktop app's global.css, translated to plain
 * JS objects since React Native has no CSS custom properties. Keeping the
 * hex values identical keeps the two apps looking like one product.
 */
interface BaseTokens {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
}

interface AccentTokens {
  accent: string;
  accentInk: string;
  accentSoft: string;
}

export interface ResolvedTheme extends BaseTokens, AccentTokens {
  scheme: 'light' | 'dark';
}

const basePalette: Record<'light' | 'dark', BaseTokens> = {
  light: {
    bg: '#EEF1EC',
    surface: '#FFFFFF',
    surface2: '#F5F7F2',
    border: '#DAE0D6',
    ink: '#1A2420',
    inkSoft: '#56615A',
    inkFaint: '#8C978E',
    success: '#3E8F5C',
    successSoft: '#E1F1E5',
    danger: '#C4443B',
    dangerSoft: '#FBE4E1',
    warning: '#B8841E',
    warningSoft: '#F8EAD1',
  },
  dark: {
    bg: '#131C18',
    surface: '#1B2620',
    surface2: '#20302A',
    border: '#31443B',
    ink: '#E9EFE9',
    inkSoft: '#A6B4A9',
    inkFaint: '#6E7E72',
    success: '#5FBF87',
    successSoft: '#183426',
    danger: '#E2685E',
    dangerSoft: '#3A1E1B',
    warning: '#E0B24D',
    warningSoft: '#382C13',
  },
};

const accentPalette: Record<'light' | 'dark', Record<AccentTheme, AccentTokens>> = {
  light: {
    amber: { accent: '#E07B1E', accentInk: '#241300', accentSoft: '#FBE7D2' },
    green: { accent: '#2F9E44', accentInk: '#072B0D', accentSoft: '#DBF4E0' },
    violet: { accent: '#7C5CE0', accentInk: '#150C2E', accentSoft: '#E6DFFB' },
    teal: { accent: '#1E8F82', accentInk: '#04201C', accentSoft: '#D8F0EC' },
  },
  dark: {
    amber: { accent: '#F0A24E', accentInk: '#1E1000', accentSoft: '#3A2A12' },
    green: { accent: '#5FD576', accentInk: '#072B0D', accentSoft: '#143B1C' },
    violet: { accent: '#A796FF', accentInk: '#150C2E', accentSoft: '#2B2350' },
    teal: { accent: '#4FC9BA', accentInk: '#04201C', accentSoft: '#123430' },
  },
};

/** Normalizes RN's `useColorScheme()` (which can be null/undefined/'unspecified') to a real scheme. */
export function normalizeSystemScheme(scheme: string | null | undefined): 'light' | 'dark' {
  return scheme === 'dark' ? 'dark' : 'light';
}

export function resolveTheme(
  mode: ThemeMode,
  systemScheme: 'light' | 'dark',
  accent: AccentTheme,
): ResolvedTheme {
  const scheme = mode === 'system' ? systemScheme : mode;
  return { ...basePalette[scheme], ...accentPalette[scheme][accent], scheme };
}
