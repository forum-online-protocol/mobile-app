import { Platform, StyleSheet } from 'react-native';

export const spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  pill: 9999,
} as const;

export const typography = {
  title: {
    fontSize: 20,
    fontWeight: '800' as const,
    letterSpacing: -0.2,
  },
  headline: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  bodyStrong: {
    fontSize: 15,
    fontWeight: '700' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  small: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
} as const;

export const hairlineWidth = StyleSheet.hairlineWidth;

export const hitSlop10 = { top: 10, bottom: 10, left: 10, right: 10 } as const;

export const monoFontFamily = Platform.select({
  ios: 'Menlo',
  default: 'monospace',
});

