export type UiMode = 'standard' | 'minimal';

type UiModeDefinition = {
  value: UiMode;
  labelKey: string;
};

const UI_MODE_STORAGE_KEY = 'nextclaw.ui.mode';
export const DEFAULT_UI_MODE: UiMode = 'standard';

const UI_MODE_DEFINITIONS: readonly UiModeDefinition[] = [
  { value: 'standard', labelKey: 'uiModeStandard' },
  { value: 'minimal', labelKey: 'uiModeMinimal' },
];

const UI_MODE_VALUES: readonly UiMode[] = UI_MODE_DEFINITIONS.map(
  ({ value }) => value,
);

export const UI_MODE_OPTIONS: Array<{ value: UiMode; labelKey: string }> =
  UI_MODE_DEFINITIONS.map(({ value, labelKey }) => ({
    value,
    labelKey,
  }));

export function normalizeUiMode(value: unknown): UiMode | null {
  if (typeof value !== 'string') {
    return null;
  }

  return (UI_MODE_VALUES as readonly string[]).includes(value)
    ? (value as UiMode)
    : null;
}

class UiModeOwner {
  private activeMode: UiMode = DEFAULT_UI_MODE;
  private initialized = false;
  private readonly listeners = new Set<(mode: UiMode) => void>();

  resolveInitialMode = (): UiMode => {
    if (typeof window === 'undefined') {
      return DEFAULT_UI_MODE;
    }

    try {
      const saved = window.localStorage.getItem(UI_MODE_STORAGE_KEY);
      const mode = normalizeUiMode(saved);
      if (mode) {
        return mode;
      }
    } catch {
      // ignore storage failures
    }

    return DEFAULT_UI_MODE;
  };

  initializeMode = (): UiMode => {
    if (!this.initialized) {
      this.activeMode = this.resolveInitialMode();
      this.initialized = true;
    }
    return this.activeMode;
  };

  getMode = (): UiMode =>
    this.initialized ? this.activeMode : this.initializeMode();

  setMode = (mode: UiMode): void => {
    this.initializeMode();
    if (mode === this.activeMode) {
      return;
    }

    this.activeMode = mode;
    this.saveMode(this.activeMode);
    this.listeners.forEach((listener) => listener(this.activeMode));
  };

  subscribeModeChange = (listener: (mode: UiMode) => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private saveMode = (mode: UiMode): void => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(UI_MODE_STORAGE_KEY, mode);
    } catch {
      // ignore storage failures
    }
  };
}

const uiModeOwner = new UiModeOwner();

export function resolveInitialMode(): UiMode {
  return uiModeOwner.resolveInitialMode();
}

export function initializeMode(): UiMode {
  return uiModeOwner.initializeMode();
}

export function getMode(): UiMode {
  return uiModeOwner.getMode();
}

export function setMode(mode: UiMode): void {
  uiModeOwner.setMode(mode);
}

export function subscribeModeChange(
  listener: (mode: UiMode) => void,
): () => void {
  return uiModeOwner.subscribeModeChange(listener);
}
