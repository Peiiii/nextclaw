import type { UiTheme } from '@/shared/lib/theme';

const PWA_SHELL_THEME_COLORS: Record<UiTheme, string> = {
  warm: '#F9F8F5',
  cool: '#F8FAFB'
};

export class PwaShellThemeManager {
  syncTheme = (theme: UiTheme) => {
    if (typeof document === 'undefined') {
      return;
    }

    const themeColor = PWA_SHELL_THEME_COLORS[theme];
    this.updateThemeMeta(themeColor);
    this.updateSurfaceBackgrounds(themeColor);
    document.documentElement.style.colorScheme = 'light';
  };

  syncCurrentTheme = () => {
    if (typeof document === 'undefined') {
      return;
    }

    const currentTheme = document.documentElement.getAttribute('data-theme') === 'cool' ? 'cool' : 'warm';
    this.syncTheme(currentTheme);
  };

  private updateThemeMeta = (themeColor: string) => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor instanceof HTMLMetaElement) {
      metaThemeColor.content = themeColor;
    }
  };

  private updateSurfaceBackgrounds = (themeColor: string) => {
    document.documentElement.style.backgroundColor = themeColor;
    document.body.style.backgroundColor = themeColor;
    const root = document.getElementById('root');
    if (root) {
      root.style.backgroundColor = themeColor;
    }
  };
}

export const pwaShellThemeManager = new PwaShellThemeManager();
