import * as NextclawCore from "@nextclaw/core";
import { discoverPluginStatusReport } from "@nextclaw/openclaw-compat";
import { loadConfigOrDefault } from "../../config.js";
import type {
  MarketplaceInstalledRecord,
  MarketplaceInstalledView,
  MarketplaceItemView,
  MarketplaceListView
} from "../../types.js";
import { readNonEmptyString } from "../response.js";
import type { SkillsLoaderConstructor, SkillsLoaderInstance, UiRouterOptions } from "../types.js";
import { MARKETPLACE_ZH_COPY_BY_SLUG } from "./constants.js";
import {
  dedupeInstalledPluginRecordsByCanonicalSpec,
  isSupportedMarketplacePluginSpec,
  normalizePluginNpmSpec,
  resolvePluginCanonicalSpec
} from "./spec.js";

const getWorkspacePathFromConfig = NextclawCore.getWorkspacePathFromConfig;

type PluginStatusReportPlugin = ReturnType<typeof discoverPluginStatusReport>["plugins"][number];
type PluginInstallRecord = {
  spec?: string;
  source?: string;
  installedAt?: string;
  installPath?: string;
};
type PluginConfigEntry = { enabled?: boolean };

function createSkillsLoader(workspace: string): SkillsLoaderInstance | null {
  const ctor = (NextclawCore as { SkillsLoader?: SkillsLoaderConstructor }).SkillsLoader;
  if (!ctor) {
    return null;
  }
  return new ctor(workspace);
}

function readPluginStatusScore(plugin: PluginStatusReportPlugin): number {
  if (plugin.status === "loaded") {
    return 300;
  }
  if (plugin.status === "disabled") {
    return 200;
  }
  return 100;
}

function readPluginOriginScore(plugin: PluginStatusReportPlugin, hasInstallRecord: boolean): number {
  if (hasInstallRecord) {
    if (plugin.origin === "workspace") {
      return 40;
    }
    if (plugin.origin === "global") {
      return 30;
    }
    if (plugin.origin === "config") {
      return 20;
    }
    return 10;
  }

  if (plugin.origin === "bundled") {
    return 40;
  }
  if (plugin.origin === "workspace") {
    return 30;
  }
  if (plugin.origin === "global") {
    return 20;
  }
  return 10;
}

function readPluginPriority(plugin: PluginStatusReportPlugin, installedPluginIds: Set<string>): number {
  return readPluginStatusScore(plugin) + readPluginOriginScore(plugin, installedPluginIds.has(plugin.id));
}

function buildDiscoveredPluginMap(params: {
  discoveredPlugins: PluginStatusReportPlugin[];
  installedPluginIds: Set<string>;
}): Map<string, PluginStatusReportPlugin> {
  const discoveredById = new Map<string, PluginStatusReportPlugin>();
  for (const plugin of params.discoveredPlugins) {
    const existing = discoveredById.get(plugin.id);
    if (!existing) {
      discoveredById.set(plugin.id, plugin);
      continue;
    }
    if (readPluginPriority(plugin, params.installedPluginIds) > readPluginPriority(existing, params.installedPluginIds)) {
      discoveredById.set(plugin.id, plugin);
    }
  }
  return discoveredById;
}

function appendDiscoveredPluginRecords(params: {
  discoveredById: Map<string, PluginStatusReportPlugin>;
  pluginRecordsMap: Record<string, PluginInstallRecord>;
  pluginEntries: Record<string, PluginConfigEntry>;
  pluginRecords: MarketplaceInstalledRecord[];
  seenPluginIds: Set<string>;
}): void {
  for (const plugin of params.discoveredById.values()) {
    const installRecord = params.pluginRecordsMap[plugin.id];
    const entry = params.pluginEntries[plugin.id];
    const normalizedSpec = resolvePluginCanonicalSpec({
      pluginId: plugin.id,
      installSpec: installRecord?.spec
    });
    const enabled = entry?.enabled === false ? false : plugin.enabled;
    const runtimeStatus = entry?.enabled === false ? "disabled" : plugin.status;

    params.pluginRecords.push({
      type: "plugin",
      id: plugin.id,
      spec: normalizedSpec,
      label: plugin.name && plugin.name.trim().length > 0 ? plugin.name : plugin.id,
      source: plugin.source,
      installedAt: installRecord?.installedAt,
      enabled,
      runtimeStatus,
      origin: plugin.origin,
      installPath: installRecord?.installPath
    });
    params.seenPluginIds.add(plugin.id);
  }
}

function appendInstalledOnlyPluginRecords(params: {
  pluginRecordsMap: Record<string, PluginInstallRecord>;
  pluginEntries: Record<string, PluginConfigEntry>;
  pluginRecords: MarketplaceInstalledRecord[];
  seenPluginIds: Set<string>;
}): void {
  for (const [pluginId, installRecord] of Object.entries(params.pluginRecordsMap)) {
    if (params.seenPluginIds.has(pluginId)) {
      continue;
    }

    const entry = params.pluginEntries[pluginId];
    params.pluginRecords.push({
      type: "plugin",
      id: pluginId,
      spec: resolvePluginCanonicalSpec({
        pluginId,
        installSpec: installRecord.spec
      }),
      label: pluginId,
      source: installRecord.source,
      installedAt: installRecord.installedAt,
      enabled: entry?.enabled !== false,
      runtimeStatus: entry?.enabled === false ? "disabled" : "unresolved",
      installPath: installRecord.installPath
    });
    params.seenPluginIds.add(pluginId);
  }
}

function appendConfigOnlyPluginRecords(params: {
  pluginEntries: Record<string, PluginConfigEntry>;
  pluginRecords: MarketplaceInstalledRecord[];
  seenPluginIds: Set<string>;
}): void {
  for (const [pluginId, entry] of Object.entries(params.pluginEntries)) {
    if (params.seenPluginIds.has(pluginId)) {
      continue;
    }

    params.pluginRecords.push({
      type: "plugin",
      id: pluginId,
      spec: resolvePluginCanonicalSpec({ pluginId }),
      label: pluginId,
      source: "config",
      enabled: entry?.enabled !== false,
      runtimeStatus: entry?.enabled === false ? "disabled" : "unresolved"
    });
    params.seenPluginIds.add(pluginId);
  }
}

function findPluginIdByExactId(pluginRecords: MarketplaceInstalledRecord[], lowerTargetId: string): string | undefined {
  for (const record of pluginRecords) {
    const recordId = record.id?.trim();
    if (recordId && recordId.toLowerCase() === lowerTargetId) {
      return recordId;
    }
  }
  return undefined;
}

function findPluginIdByNormalizedSpec(
  pluginRecords: MarketplaceInstalledRecord[],
  normalizedSpec: string
): string | undefined {
  if (!normalizedSpec) {
    return undefined;
  }
  for (const record of pluginRecords) {
    const recordId = record.id?.trim();
    if (!recordId) {
      continue;
    }
    const normalizedRecordSpec = normalizePluginNpmSpec(record.spec).toLowerCase();
    if (normalizedRecordSpec === normalizedSpec) {
      return recordId;
    }
  }
  return undefined;
}

export function collectInstalledPluginRecords(options: UiRouterOptions): {
  records: MarketplaceInstalledRecord[];
  specs: string[];
} {
  const config = loadConfigOrDefault(options.configPath);
  const pluginRecordsMap: Record<string, PluginInstallRecord> = config.plugins.installs ?? {};
  const pluginEntries: Record<string, PluginConfigEntry> = config.plugins.entries ?? {};
  const pluginRecords: MarketplaceInstalledRecord[] = [];
  const seenPluginIds = new Set<string>();
  const installedPluginIds = new Set(Object.keys(pluginRecordsMap));

  let discoveredPlugins: PluginStatusReportPlugin[] = [];
  try {
    const pluginReport = discoverPluginStatusReport({
      config,
      workspaceDir: getWorkspacePathFromConfig(config)
    });
    discoveredPlugins = pluginReport.plugins;
  } catch {
    discoveredPlugins = [];
  }

  const discoveredById = buildDiscoveredPluginMap({ discoveredPlugins, installedPluginIds });

  appendDiscoveredPluginRecords({
    discoveredById,
    pluginRecordsMap,
    pluginEntries,
    pluginRecords,
    seenPluginIds
  });
  appendInstalledOnlyPluginRecords({
    pluginRecordsMap,
    pluginEntries,
    pluginRecords,
    seenPluginIds
  });
  appendConfigOnlyPluginRecords({
    pluginEntries,
    pluginRecords,
    seenPluginIds
  });

  const dedupedPluginRecords = dedupeInstalledPluginRecordsByCanonicalSpec(pluginRecords);
  dedupedPluginRecords.sort((left, right) => {
    return left.spec.localeCompare(right.spec);
  });

  return {
    specs: dedupedPluginRecords.map((record) => record.spec),
    records: dedupedPluginRecords
  };
}

export function collectInstalledSkillRecords(options: UiRouterOptions): {
  records: MarketplaceInstalledRecord[];
  specs: string[];
} {
  const config = loadConfigOrDefault(options.configPath);
  const workspacePath = getWorkspacePathFromConfig(config);
  const skillsLoader = createSkillsLoader(workspacePath);
  const availableSkillSet = new Set((skillsLoader?.listSkills(true) ?? []).map((skill) => skill.name));
  const listedSkills = skillsLoader?.listSkills(false) ?? [];

  const records = listedSkills
    .map((skill) => {
      const enabled = availableSkillSet.has(skill.name);
      const metadata = skillsLoader?.getSkillMetadata?.(skill.name);
      const description = readNonEmptyString(metadata?.description);
      const descriptionZh =
        readNonEmptyString(metadata?.description_zh) ??
        readNonEmptyString(metadata?.descriptionZh) ??
        readNonEmptyString(MARKETPLACE_ZH_COPY_BY_SLUG[skill.name]?.description);
      return {
        type: "skill",
        id: skill.name,
        spec: skill.name,
        label: skill.name,
        ...(description ? { description } : {}),
        ...(descriptionZh ? { descriptionZh } : {}),
        source: skill.source,
        enabled,
        runtimeStatus: enabled ? "enabled" : "disabled"
      } satisfies MarketplaceInstalledRecord;
    })
    .sort((left, right) => left.spec.localeCompare(right.spec));

  return {
    specs: records.map((record) => record.spec),
    records
  };
}

export function collectPluginMarketplaceInstalledView(options: UiRouterOptions): MarketplaceInstalledView {
  const installed = collectInstalledPluginRecords(options);
  return {
    type: "plugin",
    total: installed.records.length,
    specs: installed.specs,
    records: installed.records
  };
}

export function collectSkillMarketplaceInstalledView(options: UiRouterOptions): MarketplaceInstalledView {
  const installed = collectInstalledSkillRecords(options);
  return {
    type: "skill",
    total: installed.records.length,
    specs: installed.specs,
    records: installed.records
  };
}

export function resolvePluginManageTargetId(options: UiRouterOptions, rawTargetId: string, rawSpec?: string): string {
  const targetId = rawTargetId.trim();
  if (!targetId && !rawSpec) {
    return rawTargetId;
  }

  const normalizedTarget = targetId ? normalizePluginNpmSpec(targetId).toLowerCase() : "";
  const normalizedSpec = rawSpec ? normalizePluginNpmSpec(rawSpec).toLowerCase() : "";
  const pluginRecords = collectInstalledPluginRecords(options).records;
  const lowerTargetId = targetId.toLowerCase();

  const matchedRecordId = findPluginIdByExactId(pluginRecords, lowerTargetId);
  if (matchedRecordId) {
    return matchedRecordId;
  }

  const matchedByTargetSpec = findPluginIdByNormalizedSpec(pluginRecords, normalizedTarget);
  if (matchedByTargetSpec) {
    return matchedByTargetSpec;
  }

  const matchedByRawSpec =
    normalizedSpec && normalizedSpec !== normalizedTarget
      ? findPluginIdByNormalizedSpec(pluginRecords, normalizedSpec)
      : undefined;
  if (matchedByRawSpec) {
    return matchedByRawSpec;
  }

  return targetId || rawSpec || rawTargetId;
}

export function collectKnownSkillNames(options: UiRouterOptions): Set<string> {
  const config = loadConfigOrDefault(options.configPath);
  const loader = createSkillsLoader(getWorkspacePathFromConfig(config));
  return new Set((loader?.listSkills(false) ?? []).map((skill) => skill.name));
}

export function isSupportedMarketplacePluginItem(item: MarketplaceItemView | MarketplaceListView["items"][number]): boolean {
  return item.type === "plugin" && item.install.kind === "npm" && isSupportedMarketplacePluginSpec(item.install.spec);
}

export function isSupportedMarketplaceSkillItem(
  item: MarketplaceItemView | MarketplaceListView["items"][number],
  knownSkillNames: Set<string>
): boolean {
  if (item.type !== "skill") {
    return false;
  }

  if (item.install.kind === "marketplace") {
    return true;
  }

  return item.install.kind === "builtin" && knownSkillNames.has(item.install.spec);
}

export function findUnsupportedSkillInstallKind(
  items: Array<MarketplaceItemView | MarketplaceListView["items"][number]>
): string | null {
  for (const item of items) {
    if (item.type !== "skill") {
      continue;
    }
    const kind = item.install.kind as string;
    if (kind !== "builtin" && kind !== "marketplace") {
      return kind;
    }
  }
  return null;
}
