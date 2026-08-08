const STORAGE_KEY = 'nextclaw.chat.provider-model-catalog-notices';
const STORAGE_VERSION = 1;

export const LARGE_PROVIDER_MODEL_CATALOG_THRESHOLD = 50;

type CatalogNoticeOption = {
  readonly providerId: string;
  readonly value: string;
};

type CatalogNoticeState = {
  readonly version: typeof STORAGE_VERSION;
  readonly acknowledgedModelsByProvider: Record<string, string[]>;
};

const EMPTY_STATE: CatalogNoticeState = {
  version: STORAGE_VERSION,
  acknowledgedModelsByProvider: {},
};

function readStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function groupOptions(options: readonly CatalogNoticeOption[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const option of options) {
    const values = grouped.get(option.providerId) ?? [];
    if (!values.includes(option.value)) {
      values.push(option.value);
      grouped.set(option.providerId, values);
    }
  }
  return grouped;
}

export class ProviderModelCatalogNoticeManager {
  read = (): CatalogNoticeState => {
    const storage = readStorage();
    if (!storage) {
      return EMPTY_STATE;
    }
    try {
      const value = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null') as Partial<CatalogNoticeState> | null;
      return value?.version === STORAGE_VERSION && value.acknowledgedModelsByProvider
        ? {
            version: STORAGE_VERSION,
            acknowledgedModelsByProvider: value.acknowledgedModelsByProvider,
          }
        : EMPTY_STATE;
    } catch {
      return EMPTY_STATE;
    }
  };

  write = (state: CatalogNoticeState): boolean => {
    const storage = readStorage();
    if (!storage) {
      return false;
    }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  };

  initializeLargeCatalogs = (options: readonly CatalogNoticeOption[]): boolean => {
    const state = this.read();
    const nextAcknowledged = { ...state.acknowledgedModelsByProvider };
    let changed = false;
    for (const [providerId, values] of groupOptions(options)) {
      if (
        values.length > LARGE_PROVIDER_MODEL_CATALOG_THRESHOLD &&
        !Object.prototype.hasOwnProperty.call(nextAcknowledged, providerId)
      ) {
        nextAcknowledged[providerId] = values;
        changed = true;
      }
    }
    return changed && this.write({ version: STORAGE_VERSION, acknowledgedModelsByProvider: nextAcknowledged });
  };

  filterUnseen = <T extends CatalogNoticeOption>(options: readonly T[]): T[] => {
    const acknowledged = this.read().acknowledgedModelsByProvider;
    const grouped = groupOptions(options);
    return options.filter((option) => {
      const providerAcknowledged = acknowledged[option.providerId];
      if (!providerAcknowledged) {
        return (grouped.get(option.providerId)?.length ?? 0) <= LARGE_PROVIDER_MODEL_CATALOG_THRESHOLD;
      }
      return !providerAcknowledged.includes(option.value);
    });
  };

  acknowledge = (options: readonly CatalogNoticeOption[]): boolean => {
    if (options.length === 0) {
      return false;
    }
    const state = this.read();
    const nextAcknowledged = { ...state.acknowledgedModelsByProvider };
    let changed = false;
    for (const [providerId, values] of groupOptions(options)) {
      const currentValues = nextAcknowledged[providerId] ?? [];
      const currentSet = new Set(currentValues);
      const merged = [...currentValues];
      for (const value of values) {
        if (!currentSet.has(value)) {
          currentSet.add(value);
          merged.push(value);
          changed = true;
        }
      }
      nextAcknowledged[providerId] = merged;
    }
    return changed && this.write({ version: STORAGE_VERSION, acknowledgedModelsByProvider: nextAcknowledged });
  };
}

export const providerModelCatalogNoticeManager = new ProviderModelCatalogNoticeManager();
