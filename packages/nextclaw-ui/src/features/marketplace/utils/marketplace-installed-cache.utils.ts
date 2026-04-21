import type {
  MarketplaceInstalledRecord,
  MarketplaceInstalledView,
  MarketplaceInstallRequest,
  MarketplaceInstallResult,
  MarketplaceManageRequest,
  MarketplaceManageResult,
  MarketplaceItemType
} from '@/api/types';

function dedupeSpecs(records: MarketplaceInstalledRecord[]): string[] {
  return Array.from(new Set(records.map((record) => record.spec).filter(Boolean)));
}

function buildInstalledRecordFromInstall(params: {
  request: MarketplaceInstallRequest;
  result: MarketplaceInstallResult;
}): MarketplaceInstalledRecord {
  const installedAt = new Date().toISOString();

  if (params.result.type === 'skill') {
    return {
      type: 'skill',
      spec: params.result.spec,
      id: params.request.skill ?? params.result.spec,
      label: params.request.skill ?? params.result.name ?? params.result.spec,
      source: 'workspace',
      installPath: params.request.installPath,
      installedAt
    };
  }

  return {
    type: params.result.type,
    spec: params.result.spec,
    id: params.result.name ?? params.result.spec,
    label: params.result.name ?? params.result.spec,
    source: 'marketplace',
    origin: 'marketplace',
    enabled: params.request.enabled ?? true,
    runtimeStatus: params.request.enabled === false ? 'disabled' : 'ready',
    installedAt
  };
}

function matchesInstalledRecord(record: MarketplaceInstalledRecord, params: {
  id?: string;
  spec?: string;
}): boolean {
  if (params.spec && record.spec === params.spec) {
    return true;
  }
  if (params.id && record.id === params.id) {
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
  const current = ensureInstalledView(params.result.type, params.view);
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
    type: params.result.type,
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
  const current = ensureInstalledView(params.result.type, params.view);

  if (params.result.action === 'uninstall' || params.result.action === 'remove') {
    const nextRecords = current.records.filter((record) => !matchesInstalledRecord(record, {
      id: params.result.id,
      spec: params.request.spec
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
      id: params.result.id,
      spec: params.request.spec
    })) {
      return record;
    }

    if (params.result.action === 'disable') {
      return {
        ...record,
        enabled: false,
        runtimeStatus: 'disabled'
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
