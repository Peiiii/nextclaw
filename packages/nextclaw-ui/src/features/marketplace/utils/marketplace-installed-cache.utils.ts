import type {
  MarketplaceInstalledRecord,
  MarketplaceInstalledView,
  MarketplaceInstallRequest,
  MarketplaceInstallResult,
  MarketplaceManageRequest,
  MarketplaceManageResult,
  MarketplaceItemType
} from '@/shared/lib/api';

function dedupeSpecs(records: MarketplaceInstalledRecord[]): string[] {
  return Array.from(new Set(records.map((record) => record.spec).filter(Boolean)));
}

function buildInstalledRecordFromInstall(params: {
  request: MarketplaceInstallRequest;
  result: MarketplaceInstallResult;
}): MarketplaceInstalledRecord {
  const { request, result } = params;
  const installedAt = new Date().toISOString();

  if (result.type === 'skill') {
    return {
      type: 'skill',
      spec: result.spec,
      id: request.skill ?? result.spec,
      label: request.skill ?? result.name ?? result.spec,
      source: 'workspace',
      installPath: request.installPath,
      installedAt
    };
  }

  return {
    type: result.type,
    spec: result.spec,
    id: result.name ?? result.spec,
    label: result.name ?? result.spec,
    source: 'marketplace',
    origin: 'marketplace',
    enabled: request.enabled ?? true,
    runtimeStatus: request.enabled === false ? 'disabled' : 'ready',
    installedAt
  };
}

function matchesInstalledRecord(record: MarketplaceInstalledRecord, params: {
  id?: string;
  spec?: string;
}): boolean {
  const { id, spec } = params;
  if (spec && record.spec === spec) {
    return true;
  }
  if (id && record.id === id) {
    return true;
  }
  return false;
}

function ensureInstalledView(type: MarketplaceItemType, view?: MarketplaceInstalledView): MarketplaceInstalledView {
  return view ?? {
    type,
    total: 0,
    specs: [],
    records: []
  };
}

export function applyInstallResultToInstalledView(params: {
  view?: MarketplaceInstalledView;
  request: MarketplaceInstallRequest;
  result: MarketplaceInstallResult;
}): MarketplaceInstalledView {
  const { result, view } = params;
  const current = ensureInstalledView(result.type, view);
  const optimisticRecord = buildInstalledRecordFromInstall(params);
  const existingIndex = current.records.findIndex((record) => matchesInstalledRecord(record, {
    id: optimisticRecord.id,
    spec: optimisticRecord.spec
  }));

  const nextRecords = [...current.records];
  if (existingIndex >= 0) {
    nextRecords[existingIndex] = {
      ...nextRecords[existingIndex],
      ...optimisticRecord
    };
  } else {
    nextRecords.unshift(optimisticRecord);
  }

  return {
    ...current,
    type: result.type,
    records: nextRecords,
    specs: dedupeSpecs(nextRecords),
    total: nextRecords.length
  };
}

export function applyManageResultToInstalledView(params: {
  view?: MarketplaceInstalledView;
  request: MarketplaceManageRequest;
  result: MarketplaceManageResult;
}): MarketplaceInstalledView {
  const { request, result, view } = params;
  const current = ensureInstalledView(result.type, view);

  if (result.action === 'uninstall' || result.action === 'remove') {
    const nextRecords = current.records.filter((record) => !matchesInstalledRecord(record, {
      id: result.id,
      spec: request.spec
    }));

    return {
      ...current,
      records: nextRecords,
      specs: dedupeSpecs(nextRecords),
      total: nextRecords.length
    };
  }

  const nextRecords = current.records.map((record) => {
    if (!matchesInstalledRecord(record, {
      id: result.id,
      spec: request.spec
    })) {
      return record;
    }

    if (result.action === 'disable') {
      return {
        ...record,
        enabled: false,
        runtimeStatus: 'disabled'
      };
    }

    if (result.action === 'update') {
      return {
        ...record,
        installedAt: new Date().toISOString(),
        origin: record.origin ?? 'marketplace'
      };
    }

    return {
      ...record,
      enabled: true,
      runtimeStatus: 'ready'
    };
  });

  return {
    ...current,
    records: nextRecords,
    specs: dedupeSpecs(nextRecords),
    total: nextRecords.length
  };
}
