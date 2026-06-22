export type UiTheme = 'natural' | 'minimal' | 'warm' | 'cool' | 'dawn' | 'graphite' | 'probe';

const THEME_STORAGE_KEY = 'nextclaw.ui.theme';
const DEFAULT_THEME: UiTheme = 'natural';
const THEME_VALUES: readonly UiTheme[] = ['natural', 'minimal', 'warm', 'cool', 'dawn', 'graphite', 'probe'];

export const THEME_OPTIONS: Array<{ value: UiTheme; labelKey: string }> = [
  { value: 'natural', labelKey: 'themeNatural' },
  { value: 'minimal', labelKey: 'themeMinimal' },
  { value: 'warm', labelKey: 'themeWarm' },
  { value: 'cool', labelKey: 'themeCool' },
  { value: 'dawn', labelKey: 'themeDawn' },
  { value: 'graphite', labelKey: 'themeGraphite' },
  { value: 'probe', labelKey: 'themeProbe' }
];

export function normalizeTheme(value: unknown): UiTheme | null {
  if (typeof value !== 'string') {
    return null;
  }

  if ((THEME_VALUES as readonly string[]).includes(value)) {
    return value as UiTheme;
  }

  return value === 'leaf' ? 'warm' : null;
}

class UiThemeOwner {
  private activeTheme: UiTheme = DEFAULT_THEME;
  private initialized = false;
  private readonly listeners = new Set<(theme: UiTheme) => void>();

  resolveInitialTheme = (): UiTheme => {
    if (typeof window === 'undefined') {
      return DEFAULT_THEME;
    }

    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      const theme = normalizeTheme(saved);
      if (theme) {
        return theme;
      }
    } catch {
      // ignore storage failures
    }

    return DEFAULT_THEME;
  };

  initializeTheme = (): UiTheme => {
    if (!this.initialized) {
      this.activeTheme = this.resolveInitialTheme();
      this.applyThemeAttribute(this.activeTheme);
      this.initialized = true;
    }
    return this.activeTheme;
  };

  getTheme = (): UiTheme => this.initialized ? this.activeTheme : this.initializeTheme();

  setTheme = (theme: UiTheme): void => {
    this.initializeTheme();
    if (theme === this.activeTheme) {
      return;
    }

    this.activeTheme = theme;
    this.applyThemeAttribute(this.activeTheme);
    this.saveTheme(this.activeTheme);
    this.listeners.forEach((listener) => listener(this.activeTheme));
  };

  subscribeThemeChange = (listener: (theme: UiTheme) => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private applyThemeAttribute = (theme: UiTheme): void => {
    if (typeof document === 'undefined') {
      return;
    }
    document.documentElement.setAttribute('data-theme', theme);
  };

  private saveTheme = (theme: UiTheme): void => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage failures
    }
  };
}

const uiThemeOwner = new UiThemeOwner();

export function resolveInitialTheme(): UiTheme {
  return uiThemeOwner.resolveInitialTheme();
}

export function initializeTheme(): UiTheme {
  return uiThemeOwner.initializeTheme();
}

export function getTheme(): UiTheme {
  return uiThemeOwner.getTheme();
}

export function setTheme(theme: UiTheme): void {
  uiThemeOwner.setTheme(theme);
}

export function subscribeThemeChange(listener: (theme: UiTheme) => void): () => void {
  return uiThemeOwner.subscribeThemeChange(listener);
}
