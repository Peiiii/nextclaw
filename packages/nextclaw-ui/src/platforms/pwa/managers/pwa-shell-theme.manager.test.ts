import { beforeEach, describe, expect, it } from 'vitest';
import { pwaShellThemeManager } from '@/pwa/managers/pwa-shell-theme.manager';

describe('PwaShellThemeManager', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="#F9F8F5" />';
    document.body.innerHTML = '<div id="root"></div>';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.backgroundColor = '';
    document.body.style.backgroundColor = '';
  });

  it('applies warm shell colors', () => {
    pwaShellThemeManager.syncTheme('warm');

    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute('content')).toBe('#F9F8F5');
    expect(document.body.style.backgroundColor).toBe('rgb(249, 248, 245)');
  });

  it('applies cool shell colors from current theme attribute', () => {
    document.documentElement.setAttribute('data-theme', 'cool');

    pwaShellThemeManager.syncCurrentTheme();

    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute('content')).toBe('#F8FAFB');
    expect(document.body.style.backgroundColor).toBe('rgb(248, 250, 251)');
  });
});
