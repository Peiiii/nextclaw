export type UiTheme = 'warm' | 'cool';

const THEME_STORAGE_KEY = 'nextclaw.ui.theme';

export const THEME_OPTIONS: Array<{ value: UiTheme; labelKey: string }> = [
  { value: 'warm', labelKey: 'themeWarm' },
  { value: 'cool', labelKey: 'themeCool' }
];

let activeTheme: UiTheme = 'warm';
let initialized = false;
const listeners = new Set<(theme: UiTheme) => void>();

function isTheme(value: unknown): value is UiTheme {
  return value === 'warm' || value === 'cool';
}

function applyThemeAttribute(theme: UiTheme): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.setAttribute('data-theme', theme);
}

export function resolveInitialTheme(): UiTheme {
  if (typeof window === 'undefined') {
    return 'warm';
  }

  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(saved)) {
      return saved;
    }
  } catch {
    // ignore storage failures
  }

  return 'warm';
}

export function initializeTheme(): UiTheme {
  if (!initialized) {
    activeTheme = resolveInitialTheme();
    applyThemeAttribute(activeTheme);
    initialized = true;
  }
  return activeTheme;
}

export function getTheme(): UiTheme {
  return initialized ? activeTheme : initializeTheme();
}

export function setTheme(theme: UiTheme): void {
  initializeTheme();
  if (theme === activeTheme) {
    return;
  }

  activeTheme = theme;
  applyThemeAttribute(activeTheme);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, activeTheme);
    } catch {
      // ignore storage failures
    }
  }

  listeners.forEach((listener) => listener(activeTheme));
}

export function subscribeThemeChange(listener: (theme: UiTheme) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
