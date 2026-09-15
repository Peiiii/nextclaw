import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_UI_THEME,
  getThemeAppearance,
  normalizeTheme,
  resolveInitialTheme,
  resolveTheme,
  setTheme,
  THEME_OPTIONS,
} from './index';

describe('ui theme defaults', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('uses the default theme when no preference is saved', () => {
    expect(DEFAULT_UI_THEME).toBe('default');
    expect(resolveInitialTheme()).toBe(DEFAULT_UI_THEME);
  });

  it('lists the default theme first', () => {
    expect(THEME_OPTIONS[0]?.value).toBe(DEFAULT_UI_THEME);
  });

  it('renders the alias identically while preserving the selected preference', () => {
    setTheme('work');
    setTheme('default');
    expect(document.documentElement.getAttribute('data-theme')).toBe('plain-paper');
    expect(window.localStorage.getItem('nextclaw.ui.theme')).toBe('default');
    expect(resolveInitialTheme()).toBe('default');
    setTheme('plain-paper');
    expect(document.documentElement.getAttribute('data-theme')).toBe('plain-paper');
    expect(window.localStorage.getItem('nextclaw.ui.theme')).toBe('plain-paper');
    expect(resolveTheme('default')).toBe('plain-paper');
  });

  it('keeps paper ink available independently of the default', () => {
    setTheme('paper-ink');
    expect(document.documentElement.getAttribute('data-theme')).toBe('paper-ink');
    expect(resolveInitialTheme()).toBe('paper-ink');
    expect(THEME_OPTIONS).toContainEqual({ value: 'paper-ink', labelKey: 'themePaperInk' });
  });

  it('preserves the old default as a named theme', () => {
    window.localStorage.setItem('nextclaw.ui.theme', 'work');
    expect(resolveInitialTheme()).toBe('work');
    expect(THEME_OPTIONS).toContainEqual({ value: 'work', labelKey: 'themeWork' });
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
