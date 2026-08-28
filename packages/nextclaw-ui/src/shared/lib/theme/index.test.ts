import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_UI_THEME,
  getThemeAppearance,
  normalizeTheme,
  resolveInitialTheme,
  THEME_OPTIONS,
} from './index';

describe('ui theme defaults', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('uses the default theme when no preference is saved', () => {
    expect(DEFAULT_UI_THEME).toBe('work');
    expect(resolveInitialTheme()).toBe(DEFAULT_UI_THEME);
  });

  it('lists the default theme first', () => {
    expect(THEME_OPTIONS[0]?.value).toBe(DEFAULT_UI_THEME);
  });

  it('recognizes charcoal as a dark theme', () => {
    expect(normalizeTheme('charcoal')).toBe('charcoal');
    expect(getThemeAppearance('charcoal')).toBe('dark');
    expect(THEME_OPTIONS).toContainEqual({
      value: 'charcoal',
      labelKey: 'themeCharcoal',
    });
  });

  it('recognizes island as a light theme option', () => {
    expect(normalizeTheme('island')).toBe('island');
    expect(getThemeAppearance('island')).toBe('light');
    expect(THEME_OPTIONS).toContainEqual({
      value: 'island',
      labelKey: 'themeIsland',
    });
  });
});
