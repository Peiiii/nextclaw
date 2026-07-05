import {
  getThemeAppearance,
  normalizeTheme,
  type UiTheme,
} from '@/shared/lib/theme';

const PWA_SHELL_THEME_COLORS: Record<UiTheme, string> = {
  natural: '#FAF9F7',
  minimal: '#FFFFFF',
  warm: '#FAF8F4',
  cool: '#F8FAFC',
  dawn: '#FAF7F4',
  graphite: '#F8F8F7',
  night: '#101318',
  probe: '#FEFCF6',
};

export class PwaShellThemeManager {
  syncTheme = (theme: UiTheme) => {
    if (typeof document === 'undefined') {
      return;
    }

    const themeColor = PWA_SHELL_THEME_COLORS[theme];
    this.updateThemeMeta(themeColor);
    this.updateSurfaceBackgrounds(themeColor);
    document.documentElement.style.colorScheme = getThemeAppearance(theme);
  };

  syncCurrentTheme = () => {
    if (typeof document === 'undefined') {
      return;
    }

    const currentTheme = document.documentElement.getAttribute('data-theme');
    this.syncTheme(normalizeTheme(currentTheme) ?? 'natural');
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
