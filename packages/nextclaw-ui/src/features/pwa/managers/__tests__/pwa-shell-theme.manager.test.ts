import { beforeEach, describe, expect, it } from 'vitest';
import { pwaShellThemeManager } from '@/features/pwa/managers/pwa-shell-theme.manager';

describe('PwaShellThemeManager', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="#FFFFFF" />';
    document.body.innerHTML = '<div id="root"></div>';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.backgroundColor = '';
    document.body.style.backgroundColor = '';
  });

  it('applies natural shell colors by default', () => {
    pwaShellThemeManager.syncCurrentTheme();

    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute('content')).toBe('#FAF9F7');
    expect(document.body.style.backgroundColor).toBe('rgb(250, 249, 247)');
  });

  it('applies natural shell colors explicitly', () => {
    pwaShellThemeManager.syncTheme('natural');

    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute('content')).toBe('#FAF9F7');
    expect(document.body.style.backgroundColor).toBe('rgb(250, 249, 247)');
  });

  it('applies minimal shell colors explicitly', () => {
    pwaShellThemeManager.syncTheme('minimal');

    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute('content')).toBe('#FFFFFF');
    expect(document.body.style.backgroundColor).toBe('rgb(255, 255, 255)');
  });

  it('applies warm shell colors', () => {
    pwaShellThemeManager.syncTheme('warm');

    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute('content')).toBe('#FAF8F4');
    expect(document.body.style.backgroundColor).toBe('rgb(250, 248, 244)');
  });

  it('applies cool shell colors from current theme attribute', () => {
    document.documentElement.setAttribute('data-theme', 'cool');

    pwaShellThemeManager.syncCurrentTheme();

    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute('content')).toBe('#F8FAFC');
    expect(document.body.style.backgroundColor).toBe('rgb(248, 250, 252)');
  });

  it('applies dawn shell colors from current theme attribute', () => {
    document.documentElement.setAttribute('data-theme', 'dawn');

    pwaShellThemeManager.syncCurrentTheme();

    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute('content')).toBe('#FAF7F4');
    expect(document.body.style.backgroundColor).toBe('rgb(250, 247, 244)');
  });

  it('applies graphite shell colors from current theme attribute', () => {
    document.documentElement.setAttribute('data-theme', 'graphite');

    pwaShellThemeManager.syncCurrentTheme();

    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute('content')).toBe('#F8F8F7');
    expect(document.body.style.backgroundColor).toBe('rgb(248, 248, 247)');
  });

  it('maps the legacy leaf theme to warm shell colors', () => {
    document.documentElement.setAttribute('data-theme', 'leaf');

    pwaShellThemeManager.syncCurrentTheme();

    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute('content')).toBe('#FAF8F4');
    expect(document.body.style.backgroundColor).toBe('rgb(250, 248, 244)');
  });

  it('applies probe shell colors from current theme attribute', () => {
    document.documentElement.setAttribute('data-theme', 'probe');

    pwaShellThemeManager.syncCurrentTheme();

    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute('content')).toBe('#FEFCF6');
    expect(document.body.style.backgroundColor).toBe('rgb(254, 252, 246)');
  });
});
