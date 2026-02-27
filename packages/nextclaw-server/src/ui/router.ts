import { Hono } from "hono";
import * as NextclawCore from "@nextclaw/core";
import { buildPluginStatusReport } from "@nextclaw/openclaw-compat";
import {
  buildConfigSchemaView,
  buildConfigMeta,
  buildConfigView,
  executeConfigAction,
  loadConfigOrDefault,
  updateChannel,
  updateModel,
  updateProvider,
  updateSecrets,
  updateRuntime,
  listSessions,
  getSessionHistory,
  patchSession,
  deleteSession
} from "./config.js";
import type {
  ChatTurnRequest,
  ChatTurnView,
  ConfigActionExecuteRequest,
  MarketplaceApiConfig,
  MarketplaceInstalledRecord,
  MarketplaceInstalledView,
  MarketplaceItemView,
  MarketplaceListView,
  MarketplacePluginInstallRequest,
  MarketplacePluginInstallResult,
  MarketplacePluginManageRequest,
  MarketplacePluginManageResult,
  MarketplaceRecommendationView,
  MarketplaceSkillInstallRequest,
  MarketplaceSkillInstallResult,
  MarketplaceSkillManageRequest,
  MarketplaceSkillManageResult,
  CronEnableRequest,
  CronRunRequest,
  CronActionResult,
  CronJobView,
  ProviderConfigUpdate,
  SecretsConfigUpdate,
  RuntimeConfigUpdate,
  SessionPatchUpdate,
  UiChatRuntime,
  UiServerEvent
} from "./types.js";

type UiRouterOptions = {
  configPath: string;
  publish: (event: UiServerEvent) => void;
  marketplace?: MarketplaceApiConfig;
  cronService?: InstanceType<typeof NextclawCore.CronService>;
  chatRuntime?: UiChatRuntime;
};

type CronJobEntry = {
  id: string;
  name: string;
  enabled: boolean;
  schedule: {
    kind: "at" | "every" | "cron";
    atMs?: number | null;
    everyMs?: number | null;
    expr?: string | null;
    tz?: string | null;
  };
  payload: {
    kind?: "system_event" | "agent_turn";
    message: string;
    deliver?: boolean;
    channel?: string | null;
    to?: string | null;
  };
  state: {
    nextRunAtMs?: number | null;
    lastRunAtMs?: number | null;
    lastStatus?: "ok" | "error" | "skipped" | null;
    lastError?: string | null;
  };
  createdAtMs: number;
  updatedAtMs: number;
  deleteAfterRun: boolean;
};

type SkillInfo = {
  name: string;
  path: string;
  source: "workspace" | "builtin";
};

type SkillsLoaderInstance = {
  listSkills: (filterUnavailable?: boolean) => SkillInfo[];
};

type SkillsLoaderConstructor = new (workspace: string, builtinSkillsDir?: string) => SkillsLoaderInstance;

const DEFAULT_MARKETPLACE_API_BASE = "https://marketplace-api.nextclaw.io";

const NEXTCLAW_PLUGIN_NPM_PREFIX = "@nextclaw/channel-plugin-";
const CLAWBAY_CHANNEL_PLUGIN_NPM_SPEC = "@clawbay/clawbay-channel";
const BUILTIN_CHANNEL_PLUGIN_ID_PREFIX = "builtin-channel-";
const MARKETPLACE_REMOTE_PAGE_SIZE = 100;
const MARKETPLACE_REMOTE_MAX_PAGES = 20;
const getWorkspacePathFromConfig = NextclawCore.getWorkspacePathFromConfig;

function createSkillsLoader(workspace: string): SkillsLoaderInstance | null {
  const ctor = (NextclawCore as { SkillsLoader?: SkillsLoaderConstructor }).SkillsLoader;
  if (!ctor) {
    return null;
  }
  return new ctor(workspace);
}

function normalizePluginNpmSpec(rawSpec: string): string {
  const spec = rawSpec.trim();
  if (!spec.startsWith("@")) {
    return spec;
  }

  const versionDelimiterIndex = spec.lastIndexOf("@");
  if (versionDelimiterIndex <= 0) {
    return spec;
  }

  const packageName = spec.slice(0, versionDelimiterIndex).trim();
  if (!packageName.includes("/")) {
    return spec;
  }

  return packageName;
}

function isSupportedMarketplacePluginSpec(rawSpec: string): boolean {
  const spec = normalizePluginNpmSpec(rawSpec);
  return spec.startsWith(NEXTCLAW_PLUGIN_NPM_PREFIX) || spec === CLAWBAY_CHANNEL_PLUGIN_NPM_SPEC;
}

function resolvePluginCanonicalSpec(params: {
  pluginId: string;
  installSpec?: string;
}): string {
  const rawInstallSpec = typeof params.installSpec === "string" ? params.installSpec.trim() : "";
  if (rawInstallSpec.length > 0) {
    return normalizePluginNpmSpec(rawInstallSpec);
  }

  if (params.pluginId.startsWith(BUILTIN_CHANNEL_PLUGIN_ID_PREFIX)) {
    const channelSlug = params.pluginId.slice(BUILTIN_CHANNEL_PLUGIN_ID_PREFIX.length).trim();
    if (channelSlug.length > 0) {
      return `${NEXTCLAW_PLUGIN_NPM_PREFIX}${channelSlug}`;
    }
  }

  return params.pluginId;
}

function readPluginRuntimeStatusPriority(status: string | undefined): number {
  if (status === "loaded") {
    return 400;
  }
  if (status === "disabled") {
    return 300;
  }
  if (status === "unresolved") {
    return 200;
  }
  return 100;
}

function readPluginOriginPriority(origin: string | undefined): number {
  if (origin === "bundled") {
    return 80;
  }
  if (origin === "workspace") {
    return 70;
  }
  if (origin === "global") {
    return 60;
  }
  if (origin === "config") {
    return 50;
  }
  return 10;
}

function readInstalledPluginRecordPriority(record: MarketplaceInstalledRecord): number {
  const installScore = record.installPath ? 20 : 0;
  const timestampScore = record.installedAt ? 10 : 0;
  return readPluginRuntimeStatusPriority(record.runtimeStatus) + readPluginOriginPriority(record.origin) + installScore + timestampScore;
}

function mergeInstalledPluginRecords(primary: MarketplaceInstalledRecord, secondary: MarketplaceInstalledRecord): MarketplaceInstalledRecord {
  return {
    ...primary,
    id: primary.id ?? secondary.id,
    label: primary.label ?? secondary.label,
    source: primary.source ?? secondary.source,
    installedAt: primary.installedAt ?? secondary.installedAt,
    enabled: primary.enabled ?? secondary.enabled,
    runtimeStatus: primary.runtimeStatus ?? secondary.runtimeStatus,
    origin: primary.origin ?? secondary.origin,
    installPath: primary.installPath ?? secondary.installPath
  };
}

function dedupeInstalledPluginRecordsByCanonicalSpec(records: MarketplaceInstalledRecord[]): MarketplaceInstalledRecord[] {
  const deduped = new Map<string, MarketplaceInstalledRecord>();

  for (const record of records) {
    const canonicalSpec = normalizePluginNpmSpec(record.spec).trim();
    if (!canonicalSpec) {
      continue;
    }

    const key = canonicalSpec.toLowerCase();
    const normalizedRecord = { ...record, spec: canonicalSpec };
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, normalizedRecord);
      continue;
    }

    const normalizedScore = readInstalledPluginRecordPriority(normalizedRecord);
    const existingScore = readInstalledPluginRecordPriority(existing);
    if (normalizedScore > existingScore) {
      deduped.set(key, mergeInstalledPluginRecords(normalizedRecord, existing));
      continue;
    }

    deduped.set(key, mergeInstalledPluginRecords(existing, normalizedRecord));
  }

  return Array.from(deduped.values());
}

function ok<T>(data: T) {
  return { ok: true, data };
}

function err(code: string, message: string, details?: Record<string, unknown>) {
  return { ok: false, error: { code, message, details } };
}

function toIsoTime(value?: number | null): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function buildCronJobView(job: CronJobEntry): CronJobView {
  return {
    id: job.id,
    name: job.name,
    enabled: job.enabled,
    schedule: job.schedule,
    payload: job.payload,
    state: {
      nextRunAt: toIsoTime(job.state.nextRunAtMs),
      lastRunAt: toIsoTime(job.state.lastRunAtMs),
      lastStatus: job.state.lastStatus ?? null,
      lastError: job.state.lastError ?? null
    },
    createdAt: new Date(job.createdAtMs).toISOString(),
    updatedAt: new Date(job.updatedAtMs).toISOString(),
    deleteAfterRun: job.deleteAfterRun
  };
}

function findCronJob(service: InstanceType<typeof NextclawCore.CronService>, id: string): CronJobEntry | null {
  const jobs = service.listJobs(true) as CronJobEntry[];
  return jobs.find((job) => job.id === id) ?? null;
}

async function readJson<T>(req: Request): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    const data = (await req.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readErrorMessage(value: unknown, fallback: string): string {
  if (!isRecord(value)) {
    return fallback;
  }

  const maybeError = value.error;
  if (!isRecord(maybeError)) {
    return fallback;
  }

  return typeof maybeError.message === "string" && maybeError.message.trim().length > 0
    ? maybeError.message
    : fallback;
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function resolveAgentIdFromSessionKey(sessionKey?: string): string | undefined {
  const parsed = NextclawCore.parseAgentScopedSessionKey(sessionKey);
  const agentId = readNonEmptyString(parsed?.agentId);
  return agentId;
}

function normalizeMarketplaceBaseUrl(options: UiRouterOptions): string {
  const fromOptions = options.marketplace?.apiBaseUrl?.trim();
  const fromEnv = process.env.NEXTCLAW_MARKETPLACE_API_BASE?.trim();
  const value = fromOptions || fromEnv || DEFAULT_MARKETPLACE_API_BASE;
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function toMarketplaceUrl(baseUrl: string, path: string, query: Record<string, string | undefined> = {}): string {
  const url = new URL(path, `${baseUrl}/`);
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string" && value.trim().length > 0) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

async function fetchMarketplaceData<T>(params: {
  baseUrl: string;
  path: string;
  query?: Record<string, string | undefined>;
}): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const url = toMarketplaceUrl(params.baseUrl, params.path, params.query ?? {});

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: readErrorMessage(payload, `marketplace request failed: ${response.status}`)
      };
    }

    if (!isRecord(payload) || payload.ok !== true || !Object.prototype.hasOwnProperty.call(payload, "data")) {
      return {
        ok: false,
        status: 502,
        message: "invalid marketplace response"
      };
    }

    return {
      ok: true,
      data: payload.data as T
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      message: `marketplace fetch failed: ${String(error)}`
    };
  }
}

function collectInstalledPluginRecords(options: UiRouterOptions): {
  records: MarketplaceInstalledRecord[];
  specs: string[];
} {
  const config = loadConfigOrDefault(options.configPath);
  const pluginRecordsMap = config.plugins.installs ?? {};
  const pluginEntries = config.plugins.entries ?? {};
  const pluginRecords: MarketplaceInstalledRecord[] = [];
  const seenPluginIds = new Set<string>();

  let discoveredPlugins: ReturnType<typeof buildPluginStatusReport>["plugins"] = [];
  try {
    const pluginReport = buildPluginStatusReport({
      config,
      workspaceDir: getWorkspacePathFromConfig(config)
    });
    discoveredPlugins = pluginReport.plugins;
  } catch {
    discoveredPlugins = [];
  }

  const readPluginPriority = (plugin: ReturnType<typeof buildPluginStatusReport>["plugins"][number]): number => {
    const hasInstallRecord = Boolean(pluginRecordsMap[plugin.id]);

    const statusScore = plugin.status === "loaded"
      ? 300
      : plugin.status === "disabled"
        ? 200
        : 100;

    let originScore = 0;
    if (hasInstallRecord) {
      originScore = plugin.origin === "workspace"
        ? 40
        : plugin.origin === "global"
          ? 30
          : plugin.origin === "config"
            ? 20
            : 10;
    } else {
      originScore = plugin.origin === "bundled"
        ? 40
        : plugin.origin === "workspace"
          ? 30
          : plugin.origin === "global"
            ? 20
            : 10;
    }

    return statusScore + originScore;
  };

  const discoveredById = new Map<string, ReturnType<typeof buildPluginStatusReport>["plugins"][number]>();
  for (const plugin of discoveredPlugins) {
    const existing = discoveredById.get(plugin.id);
    if (!existing) {
      discoveredById.set(plugin.id, plugin);
      continue;
    }

    if (readPluginPriority(plugin) > readPluginPriority(existing)) {
      discoveredById.set(plugin.id, plugin);
    }
  }

  for (const plugin of discoveredById.values()) {
    const installRecord = pluginRecordsMap[plugin.id];
    const entry = pluginEntries[plugin.id];
    const normalizedSpec = resolvePluginCanonicalSpec({
      pluginId: plugin.id,
      installSpec: installRecord?.spec
    });
    const enabled = entry?.enabled === false ? false : plugin.enabled;
    const runtimeStatus = entry?.enabled === false ? "disabled" : plugin.status;

    pluginRecords.push({
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
    seenPluginIds.add(plugin.id);
  }

  for (const [pluginId, installRecord] of Object.entries(pluginRecordsMap)) {
    if (seenPluginIds.has(pluginId)) {
      continue;
    }

    const normalizedSpec = resolvePluginCanonicalSpec({
      pluginId,
      installSpec: installRecord.spec
    });
    const entry = pluginEntries[pluginId];
    pluginRecords.push({
      type: "plugin",
      id: pluginId,
      spec: normalizedSpec,
      label: pluginId,
      source: installRecord.source,
      installedAt: installRecord.installedAt,
      enabled: entry?.enabled !== false,
      runtimeStatus: entry?.enabled === false ? "disabled" : "unresolved",
      installPath: installRecord.installPath
    });
    seenPluginIds.add(pluginId);
  }

  for (const [pluginId, entry] of Object.entries(pluginEntries)) {
    if (!seenPluginIds.has(pluginId)) {
      const normalizedSpec = resolvePluginCanonicalSpec({ pluginId });
      pluginRecords.push({
        type: "plugin",
        id: pluginId,
        spec: normalizedSpec,
        label: pluginId,
        source: "config",
        enabled: entry?.enabled !== false,
        runtimeStatus: entry?.enabled === false ? "disabled" : "unresolved"
      });
      seenPluginIds.add(pluginId);
    }
  }

  const dedupedPluginRecords = dedupeInstalledPluginRecordsByCanonicalSpec(pluginRecords);
  dedupedPluginRecords.sort((left, right) => {
    return left.spec.localeCompare(right.spec);
  });

  return {
    specs: dedupedPluginRecords.map((record) => record.spec),
    records: dedupedPluginRecords
  };
}

function collectInstalledSkillRecords(options: UiRouterOptions): {
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
      return {
        type: "skill",
        id: skill.name,
        spec: skill.name,
        label: skill.name,
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

function collectPluginMarketplaceInstalledView(options: UiRouterOptions): MarketplaceInstalledView {
  const installed = collectInstalledPluginRecords(options);
  return {
    type: "plugin",
    total: installed.records.length,
    specs: installed.specs,
    records: installed.records
  };
}

function collectSkillMarketplaceInstalledView(options: UiRouterOptions): MarketplaceInstalledView {
  const installed = collectInstalledSkillRecords(options);
  return {
    type: "skill",
    total: installed.records.length,
    specs: installed.specs,
    records: installed.records
  };
}

function resolvePluginManageTargetId(options: UiRouterOptions, rawTargetId: string, rawSpec?: string): string {
  const targetId = rawTargetId.trim();
  if (!targetId && !rawSpec) {
    return rawTargetId;
  }

  const normalizedTarget = targetId ? normalizePluginNpmSpec(targetId).toLowerCase() : "";
  const normalizedSpec = rawSpec ? normalizePluginNpmSpec(rawSpec).toLowerCase() : "";
  const pluginRecords = collectInstalledPluginRecords(options).records;
  const lowerTargetId = targetId.toLowerCase();

  for (const record of pluginRecords) {
    const recordId = record.id?.trim();
    if (recordId && recordId.toLowerCase() === lowerTargetId) {
      return recordId;
    }
  }

  if (normalizedTarget) {
    for (const record of pluginRecords) {
      const normalizedRecordSpec = normalizePluginNpmSpec(record.spec).toLowerCase();
      if (normalizedRecordSpec === normalizedTarget && record.id && record.id.trim().length > 0) {
        return record.id;
      }
    }
  }

  if (normalizedSpec && normalizedSpec !== normalizedTarget) {
    for (const record of pluginRecords) {
      const normalizedRecordSpec = normalizePluginNpmSpec(record.spec).toLowerCase();
      if (normalizedRecordSpec === normalizedSpec && record.id && record.id.trim().length > 0) {
        return record.id;
      }
    }
  }

  return targetId || rawSpec || rawTargetId;
}

function sanitizeMarketplaceItem<T extends Record<string, unknown>>(item: T): T {
  const next = { ...item } as T & { metrics?: unknown };
  delete next.metrics;
  return next;
}

function toPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function collectKnownSkillNames(options: UiRouterOptions): Set<string> {
  const config = loadConfigOrDefault(options.configPath);
  const loader = createSkillsLoader(getWorkspacePathFromConfig(config));
  return new Set((loader?.listSkills(false) ?? []).map((skill) => skill.name));
}

function isSupportedMarketplacePluginItem(item: MarketplaceItemView | MarketplaceListView["items"][number]): boolean {
  return item.type === "plugin" && item.install.kind === "npm" && isSupportedMarketplacePluginSpec(item.install.spec);
}

function isSupportedMarketplaceSkillItem(
  item: MarketplaceItemView | MarketplaceListView["items"][number],
  knownSkillNames: Set<string>
): boolean {
  if (item.type !== "skill") {
    return false;
  }

  if (item.install.kind === "git") {
    return true;
  }

  return item.install.kind === "builtin" && knownSkillNames.has(item.install.spec);
}

async function fetchAllMarketplaceItems(params: {
  baseUrl: string;
  segment: "plugins" | "skills";
  query: Record<string, string | undefined>;
}): Promise<
  | { ok: true; data: { sort: MarketplaceListView["sort"]; query?: string; items: MarketplaceListView["items"] } }
  | { ok: false; status: number; message: string }
> {
  const allItems: MarketplaceListView["items"] = [];
  let remotePage = 1;
  let remoteTotalPages = 1;
  let sort: MarketplaceListView["sort"] = "relevance";
  let query: MarketplaceListView["query"];

  while (remotePage <= remoteTotalPages && remotePage <= MARKETPLACE_REMOTE_MAX_PAGES) {
    const result = await fetchMarketplaceData<MarketplaceListView>({
      baseUrl: params.baseUrl,
      path: `/api/v1/${params.segment}/items`,
      query: {
        ...params.query,
        page: String(remotePage),
        pageSize: String(MARKETPLACE_REMOTE_PAGE_SIZE)
      }
    });

    if (!result.ok) {
      return result;
    }

    allItems.push(...result.data.items);
    remoteTotalPages = result.data.totalPages;
    sort = result.data.sort;
    query = result.data.query;
    remotePage += 1;
  }

  return {
    ok: true,
    data: {
      sort,
      query,
      items: allItems
    }
  };
}

async function fetchAllPluginMarketplaceItems(params: {
  baseUrl: string;
  query: Record<string, string | undefined>;
}) {
  return await fetchAllMarketplaceItems({
    baseUrl: params.baseUrl,
    segment: "plugins",
    query: params.query
  });
}

async function fetchAllSkillMarketplaceItems(params: {
  baseUrl: string;
  query: Record<string, string | undefined>;
}) {
  return await fetchAllMarketplaceItems({
    baseUrl: params.baseUrl,
    segment: "skills",
    query: params.query
  });
}

async function installMarketplacePlugin(params: {
  options: UiRouterOptions;
  body: MarketplacePluginInstallRequest;
}): Promise<MarketplacePluginInstallResult> {
  const spec = typeof params.body.spec === "string" ? params.body.spec.trim() : "";
  if (!spec) {
    throw new Error("INVALID_BODY:non-empty spec is required");
  }

  const installer = params.options.marketplace?.installer;
  if (!installer) {
    throw new Error("NOT_AVAILABLE:marketplace installer is not configured");
  }

  if (!installer.installPlugin) {
    throw new Error("NOT_AVAILABLE:plugin installer is not configured");
  }
  const result = await installer.installPlugin(spec);

  params.options.publish({ type: "config.updated", payload: { path: "plugins" } });
  return {
    type: "plugin",
    spec,
    message: result.message,
    output: result.output
  };
}

async function installMarketplaceSkill(params: {
  options: UiRouterOptions;
  body: MarketplaceSkillInstallRequest;
}): Promise<MarketplaceSkillInstallResult> {
  const spec = typeof params.body.spec === "string" ? params.body.spec.trim() : "";
  if (!spec) {
    throw new Error("INVALID_BODY:non-empty spec is required");
  }

  const installer = params.options.marketplace?.installer;
  if (!installer) {
    throw new Error("NOT_AVAILABLE:marketplace installer is not configured");
  }
  if (!installer.installSkill) {
    throw new Error("NOT_AVAILABLE:skill installer is not configured");
  }

  const result = await installer.installSkill({
    slug: spec,
    kind: params.body.kind,
    skill: params.body.skill,
    installPath: params.body.installPath,
    version: params.body.version,
    registry: params.body.registry,
    force: params.body.force
  });

  params.options.publish({ type: "config.updated", payload: { path: "skills" } });
  return {
    type: "skill",
    spec,
    message: result.message,
    output: result.output
  };
}

async function manageMarketplacePlugin(params: {
  options: UiRouterOptions;
  body: MarketplacePluginManageRequest;
}): Promise<MarketplacePluginManageResult> {
  const action = params.body.action;
  const requestedTargetId = typeof params.body.id === "string" && params.body.id.trim().length > 0
    ? params.body.id.trim()
    : typeof params.body.spec === "string" && params.body.spec.trim().length > 0
      ? params.body.spec.trim()
      : "";

  const rawSpec = typeof params.body.spec === "string" ? params.body.spec.trim() : "";
  const targetId = resolvePluginManageTargetId(params.options, requestedTargetId, rawSpec);

  if ((action !== "enable" && action !== "disable" && action !== "uninstall") || !targetId) {
    throw new Error("INVALID_BODY:action and non-empty id/spec are required");
  }

  const installer = params.options.marketplace?.installer;
  if (!installer) {
    throw new Error("NOT_AVAILABLE:marketplace installer is not configured");
  }

  let result: { message: string; output?: string };

  if (action === "enable") {
    if (!installer.enablePlugin) {
      throw new Error("NOT_AVAILABLE:plugin enable is not configured");
    }
    result = await installer.enablePlugin(targetId);
  } else if (action === "disable") {
    if (!installer.disablePlugin) {
      throw new Error("NOT_AVAILABLE:plugin disable is not configured");
    }
    result = await installer.disablePlugin(targetId);
  } else {
    if (!installer.uninstallPlugin) {
      throw new Error("NOT_AVAILABLE:plugin uninstall is not configured");
    }
    result = await installer.uninstallPlugin(targetId);
  }

  params.options.publish({ type: "config.updated", payload: { path: "plugins" } });

  return {
    type: "plugin",
    action,
    id: targetId,
    message: result.message,
    output: result.output
  };
}

async function manageMarketplaceSkill(params: {
  options: UiRouterOptions;
  body: MarketplaceSkillManageRequest;
}): Promise<MarketplaceSkillManageResult> {
  const action = params.body.action;
  const targetId = typeof params.body.id === "string" && params.body.id.trim().length > 0
    ? params.body.id.trim()
    : typeof params.body.spec === "string" && params.body.spec.trim().length > 0
      ? params.body.spec.trim()
      : "";

  if (action !== "uninstall" || !targetId) {
    throw new Error("INVALID_BODY:skill manage requires uninstall action and non-empty id/spec");
  }

  const installer = params.options.marketplace?.installer;
  if (!installer) {
    throw new Error("NOT_AVAILABLE:marketplace installer is not configured");
  }
  if (!installer.uninstallSkill) {
    throw new Error("NOT_AVAILABLE:skill uninstall is not configured");
  }

  const result = await installer.uninstallSkill(targetId);
  params.options.publish({ type: "config.updated", payload: { path: "skills" } });

  return {
    type: "skill",
    action,
    id: targetId,
    message: result.message,
    output: result.output
  };
}

function registerPluginMarketplaceRoutes(app: Hono, options: UiRouterOptions, marketplaceBaseUrl: string): void {
  app.get("/api/marketplace/plugins/installed", (c) => {
    return c.json(ok(collectPluginMarketplaceInstalledView(options)));
  });

  app.get("/api/marketplace/plugins/items", async (c) => {
    const query = c.req.query();
    const result = await fetchAllPluginMarketplaceItems({
      baseUrl: marketplaceBaseUrl,
      query: {
        q: query.q,
        tag: query.tag,
        sort: query.sort,
        page: query.page,
        pageSize: query.pageSize
      }
    });

    if (!result.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", result.message), result.status as 500);
    }

    const filteredItems = result.data.items
      .map((item) => sanitizeMarketplaceItem(item))
      .filter((item) => isSupportedMarketplacePluginItem(item));

    const pageSize = Math.min(100, toPositiveInt(query.pageSize, 20));
    const requestedPage = toPositiveInt(query.page, 1);
    const totalPages = filteredItems.length === 0 ? 0 : Math.ceil(filteredItems.length / pageSize);
    const currentPage = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);

    return c.json(ok({
      total: filteredItems.length,
      page: currentPage,
      pageSize,
      totalPages,
      sort: result.data.sort,
      query: result.data.query,
      items: filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    }));
  });

  app.get("/api/marketplace/plugins/items/:slug", async (c) => {
    const slug = encodeURIComponent(c.req.param("slug"));
    const result = await fetchMarketplaceData<MarketplaceItemView>({
      baseUrl: marketplaceBaseUrl,
      path: `/api/v1/plugins/items/${slug}`
    });

    if (!result.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", result.message), result.status as 500);
    }

    const sanitized = sanitizeMarketplaceItem(result.data);
    if (!isSupportedMarketplacePluginItem(sanitized)) {
      return c.json(err("NOT_FOUND", "marketplace item not supported by nextclaw"), 404);
    }

    return c.json(ok(sanitized));
  });

  app.post("/api/marketplace/plugins/install", async (c) => {
    const body = await readJson<MarketplacePluginInstallRequest>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    if (body.data.type && body.data.type !== "plugin") {
      return c.json(err("INVALID_BODY", "body.type does not match route type"), 400);
    }

    try {
      const payload = await installMarketplacePlugin({
        options,
        body: body.data
      });
      return c.json(ok(payload));
    } catch (error) {
      const message = String(error);
      if (message.startsWith("INVALID_BODY:")) {
        return c.json(err("INVALID_BODY", message.slice("INVALID_BODY:".length)), 400);
      }
      if (message.startsWith("NOT_AVAILABLE:")) {
        return c.json(err("NOT_AVAILABLE", message.slice("NOT_AVAILABLE:".length)), 503);
      }
      return c.json(err("INSTALL_FAILED", message), 400);
    }
  });

  app.post("/api/marketplace/plugins/manage", async (c) => {
    const body = await readJson<MarketplacePluginManageRequest>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    if (body.data.type && body.data.type !== "plugin") {
      return c.json(err("INVALID_BODY", "body.type does not match route type"), 400);
    }

    try {
      const payload = await manageMarketplacePlugin({
        options,
        body: body.data
      });
      return c.json(ok(payload));
    } catch (error) {
      const message = String(error);
      if (message.startsWith("INVALID_BODY:")) {
        return c.json(err("INVALID_BODY", message.slice("INVALID_BODY:".length)), 400);
      }
      if (message.startsWith("NOT_AVAILABLE:")) {
        return c.json(err("NOT_AVAILABLE", message.slice("NOT_AVAILABLE:".length)), 503);
      }
      return c.json(err("MANAGE_FAILED", message), 400);
    }
  });

  app.get("/api/marketplace/plugins/recommendations", async (c) => {
    const query = c.req.query();
    const result = await fetchMarketplaceData<MarketplaceRecommendationView>({
      baseUrl: marketplaceBaseUrl,
      path: "/api/v1/plugins/recommendations",
      query: {
        scene: query.scene,
        limit: query.limit
      }
    });

    if (!result.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", result.message), result.status as 500);
    }

    const filteredItems = result.data.items
      .map((item) => sanitizeMarketplaceItem(item))
      .filter((item) => isSupportedMarketplacePluginItem(item));

    return c.json(ok({
      ...result.data,
      total: filteredItems.length,
      items: filteredItems
    }));
  });
}

function registerSkillMarketplaceRoutes(app: Hono, options: UiRouterOptions, marketplaceBaseUrl: string): void {
  app.get("/api/marketplace/skills/installed", (c) => {
    return c.json(ok(collectSkillMarketplaceInstalledView(options)));
  });

  app.get("/api/marketplace/skills/items", async (c) => {
    const query = c.req.query();
    const result = await fetchAllSkillMarketplaceItems({
      baseUrl: marketplaceBaseUrl,
      query: {
        q: query.q,
        tag: query.tag,
        sort: query.sort,
        page: query.page,
        pageSize: query.pageSize
      }
    });

    if (!result.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", result.message), result.status as 500);
    }

    const knownSkillNames = collectKnownSkillNames(options);
    const filteredItems = result.data.items
      .map((item) => sanitizeMarketplaceItem(item))
      .filter((item) => isSupportedMarketplaceSkillItem(item, knownSkillNames));

    const pageSize = Math.min(100, toPositiveInt(query.pageSize, 20));
    const requestedPage = toPositiveInt(query.page, 1);
    const totalPages = filteredItems.length === 0 ? 0 : Math.ceil(filteredItems.length / pageSize);
    const currentPage = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);

    return c.json(ok({
      total: filteredItems.length,
      page: currentPage,
      pageSize,
      totalPages,
      sort: result.data.sort,
      query: result.data.query,
      items: filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    }));
  });

  app.get("/api/marketplace/skills/items/:slug", async (c) => {
    const slug = encodeURIComponent(c.req.param("slug"));
    const result = await fetchMarketplaceData<MarketplaceItemView>({
      baseUrl: marketplaceBaseUrl,
      path: `/api/v1/skills/items/${slug}`
    });

    if (!result.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", result.message), result.status as 500);
    }

    const knownSkillNames = collectKnownSkillNames(options);
    const sanitized = sanitizeMarketplaceItem(result.data);
    if (!isSupportedMarketplaceSkillItem(sanitized, knownSkillNames)) {
      return c.json(err("NOT_FOUND", "marketplace item not supported by nextclaw"), 404);
    }

    return c.json(ok(sanitized));
  });

  app.post("/api/marketplace/skills/install", async (c) => {
    const body = await readJson<MarketplaceSkillInstallRequest>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    if (body.data.type && body.data.type !== "skill") {
      return c.json(err("INVALID_BODY", "body.type does not match route type"), 400);
    }

    try {
      const payload = await installMarketplaceSkill({
        options,
        body: body.data
      });
      return c.json(ok(payload));
    } catch (error) {
      const message = String(error);
      if (message.startsWith("INVALID_BODY:")) {
        return c.json(err("INVALID_BODY", message.slice("INVALID_BODY:".length)), 400);
      }
      if (message.startsWith("NOT_AVAILABLE:")) {
        return c.json(err("NOT_AVAILABLE", message.slice("NOT_AVAILABLE:".length)), 503);
      }
      return c.json(err("INSTALL_FAILED", message), 400);
    }
  });

  app.post("/api/marketplace/skills/manage", async (c) => {
    const body = await readJson<MarketplaceSkillManageRequest>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    if (body.data.type && body.data.type !== "skill") {
      return c.json(err("INVALID_BODY", "body.type does not match route type"), 400);
    }

    try {
      const payload = await manageMarketplaceSkill({
        options,
        body: body.data
      });
      return c.json(ok(payload));
    } catch (error) {
      const message = String(error);
      if (message.startsWith("INVALID_BODY:")) {
        return c.json(err("INVALID_BODY", message.slice("INVALID_BODY:".length)), 400);
      }
      if (message.startsWith("NOT_AVAILABLE:")) {
        return c.json(err("NOT_AVAILABLE", message.slice("NOT_AVAILABLE:".length)), 503);
      }
      return c.json(err("MANAGE_FAILED", message), 400);
    }
  });

  app.get("/api/marketplace/skills/recommendations", async (c) => {
    const query = c.req.query();
    const result = await fetchMarketplaceData<MarketplaceRecommendationView>({
      baseUrl: marketplaceBaseUrl,
      path: "/api/v1/skills/recommendations",
      query: {
        scene: query.scene,
        limit: query.limit
      }
    });

    if (!result.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", result.message), result.status as 500);
    }

    const knownSkillNames = collectKnownSkillNames(options);
    const filteredItems = result.data.items
      .map((item) => sanitizeMarketplaceItem(item))
      .filter((item) => isSupportedMarketplaceSkillItem(item, knownSkillNames));

    return c.json(ok({
      ...result.data,
      total: filteredItems.length,
      items: filteredItems
    }));
  });
}

function registerMarketplaceRoutes(app: Hono, options: UiRouterOptions, marketplaceBaseUrl: string): void {
  registerPluginMarketplaceRoutes(app, options, marketplaceBaseUrl);
  registerSkillMarketplaceRoutes(app, options, marketplaceBaseUrl);
}

export function createUiRouter(options: UiRouterOptions): Hono {
  const app = new Hono();
  const marketplaceBaseUrl = normalizeMarketplaceBaseUrl(options);

  app.notFound((c) => c.json(err("NOT_FOUND", "endpoint not found"), 404));

  app.get("/api/health", (c) => c.json(ok({ status: "ok" })));

  app.get("/api/config", (c) => {
    const config = loadConfigOrDefault(options.configPath);
    return c.json(ok(buildConfigView(config)));
  });

  app.get("/api/config/meta", (c) => {
    const config = loadConfigOrDefault(options.configPath);
    return c.json(ok(buildConfigMeta(config)));
  });

  app.get("/api/config/schema", (c) => {
    const config = loadConfigOrDefault(options.configPath);
    return c.json(ok(buildConfigSchemaView(config)));
  });

  app.put("/api/config/model", async (c) => {
    const body = await readJson<{ model?: string; maxTokens?: number }>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }

    const hasModel = typeof body.data.model === "string";
    const hasMaxTokens = typeof body.data.maxTokens === "number";
    if (!hasModel && !hasMaxTokens) {
      return c.json(err("INVALID_BODY", "model or maxTokens is required"), 400);
    }

    const view = updateModel(options.configPath, {
      model: hasModel ? body.data.model : undefined,
      maxTokens: hasMaxTokens ? body.data.maxTokens : undefined
    });

    if (hasModel) {
      options.publish({ type: "config.updated", payload: { path: "agents.defaults.model" } });
    }
    if (hasMaxTokens) {
      options.publish({ type: "config.updated", payload: { path: "agents.defaults.maxTokens" } });
    }

    return c.json(ok({
      model: view.agents.defaults.model,
      maxTokens: view.agents.defaults.maxTokens
    }));
  });

  app.put("/api/config/providers/:provider", async (c) => {
    const provider = c.req.param("provider");
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = updateProvider(options.configPath, provider, body.data as ProviderConfigUpdate);
    if (!result) {
      return c.json(err("NOT_FOUND", `unknown provider: ${provider}`), 404);
    }
    options.publish({ type: "config.updated", payload: { path: `providers.${provider}` } });
    return c.json(ok(result));
  });

  app.put("/api/config/channels/:channel", async (c) => {
    const channel = c.req.param("channel");
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = updateChannel(options.configPath, channel, body.data);
    if (!result) {
      return c.json(err("NOT_FOUND", `unknown channel: ${channel}`), 404);
    }
    options.publish({ type: "config.updated", payload: { path: `channels.${channel}` } });
    return c.json(ok(result));
  });

  app.put("/api/config/secrets", async (c) => {
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = updateSecrets(options.configPath, body.data as SecretsConfigUpdate);
    options.publish({ type: "config.updated", payload: { path: "secrets" } });
    return c.json(ok(result));
  });

  app.post("/api/chat/turn", async (c) => {
    if (!options.chatRuntime) {
      return c.json(err("NOT_AVAILABLE", "chat runtime unavailable"), 503);
    }

    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }

    const message = readNonEmptyString(body.data.message);
    if (!message) {
      return c.json(err("INVALID_BODY", "message is required"), 400);
    }

    const sessionKey =
      readNonEmptyString(body.data.sessionKey) ??
      `ui:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
    const requestedAt = new Date();
    const startedAtMs = requestedAt.getTime();

    const metadata = isRecord(body.data.metadata) ? body.data.metadata : undefined;
    const requestedAgentId = readNonEmptyString(body.data.agentId) ?? resolveAgentIdFromSessionKey(sessionKey);
    const requestedModel = readNonEmptyString(body.data.model);
    const request: ChatTurnRequest = {
      message,
      sessionKey,
      channel: readNonEmptyString(body.data.channel) ?? "ui",
      chatId: readNonEmptyString(body.data.chatId) ?? "web-ui",
      ...(requestedAgentId ? { agentId: requestedAgentId } : {}),
      ...(requestedModel ? { model: requestedModel } : {}),
      ...(metadata ? { metadata } : {})
    };

    try {
      const result = await options.chatRuntime.processTurn(request);
      const completedAt = new Date();
      const response: ChatTurnView = {
        reply: String(result.reply ?? ""),
        sessionKey: readNonEmptyString(result.sessionKey) ?? sessionKey,
        ...(readNonEmptyString(result.agentId) || requestedAgentId
          ? { agentId: readNonEmptyString(result.agentId) ?? requestedAgentId }
          : {}),
        ...(readNonEmptyString(result.model) || requestedModel
          ? { model: readNonEmptyString(result.model) ?? requestedModel }
          : {}),
        requestedAt: requestedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: Math.max(0, completedAt.getTime() - startedAtMs)
      };
      options.publish({ type: "config.updated", payload: { path: "session" } });
      return c.json(ok(response));
    } catch (error) {
      return c.json(err("CHAT_TURN_FAILED", String(error)), 500);
    }
  });

  app.get("/api/sessions", (c) => {
    const query = c.req.query();
    const q = typeof query.q === "string" ? query.q : undefined;
    const limit = typeof query.limit === "string" ? Number.parseInt(query.limit, 10) : undefined;
    const activeMinutes =
      typeof query.activeMinutes === "string" ? Number.parseInt(query.activeMinutes, 10) : undefined;
    const data = listSessions(options.configPath, {
      q,
      limit: Number.isFinite(limit) ? limit : undefined,
      activeMinutes: Number.isFinite(activeMinutes) ? activeMinutes : undefined
    });
    return c.json(ok(data));
  });

  app.get("/api/sessions/:key/history", (c) => {
    const key = decodeURIComponent(c.req.param("key"));
    const query = c.req.query();
    const limit = typeof query.limit === "string" ? Number.parseInt(query.limit, 10) : undefined;
    const data = getSessionHistory(options.configPath, key, Number.isFinite(limit) ? limit : undefined);
    if (!data) {
      return c.json(err("NOT_FOUND", `session not found: ${key}`), 404);
    }
    return c.json(ok(data));
  });

  app.put("/api/sessions/:key", async (c) => {
    const key = decodeURIComponent(c.req.param("key"));
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const data = patchSession(options.configPath, key, body.data as SessionPatchUpdate);
    if (!data) {
      return c.json(err("NOT_FOUND", `session not found: ${key}`), 404);
    }
    options.publish({ type: "config.updated", payload: { path: "session" } });
    return c.json(ok(data));
  });

  app.delete("/api/sessions/:key", (c) => {
    const key = decodeURIComponent(c.req.param("key"));
    const deleted = deleteSession(options.configPath, key);
    if (!deleted) {
      return c.json(err("NOT_FOUND", `session not found: ${key}`), 404);
    }
    options.publish({ type: "config.updated", payload: { path: "session" } });
    return c.json(ok({ deleted: true }));
  });

  app.get("/api/cron", (c) => {
    if (!options.cronService) {
      return c.json(err("NOT_AVAILABLE", "cron service unavailable"), 503);
    }
    const query = c.req.query();
    const includeDisabled = query.all === "1" || query.all === "true" || query.all === "yes";
    const jobs = options.cronService.listJobs(includeDisabled).map((job) => buildCronJobView(job as CronJobEntry));
    return c.json(ok({ jobs, total: jobs.length }));
  });

  app.delete("/api/cron/:id", (c) => {
    if (!options.cronService) {
      return c.json(err("NOT_AVAILABLE", "cron service unavailable"), 503);
    }
    const id = decodeURIComponent(c.req.param("id"));
    const deleted = options.cronService.removeJob(id);
    if (!deleted) {
      return c.json(err("NOT_FOUND", `cron job not found: ${id}`), 404);
    }
    return c.json(ok({ deleted: true }));
  });

  app.put("/api/cron/:id/enable", async (c) => {
    if (!options.cronService) {
      return c.json(err("NOT_AVAILABLE", "cron service unavailable"), 503);
    }
    const id = decodeURIComponent(c.req.param("id"));
    const body = await readJson<CronEnableRequest>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    if (typeof body.data.enabled !== "boolean") {
      return c.json(err("INVALID_BODY", "enabled must be boolean"), 400);
    }
    const job = options.cronService.enableJob(id, body.data.enabled);
    if (!job) {
      return c.json(err("NOT_FOUND", `cron job not found: ${id}`), 404);
    }
    const data: CronActionResult = { job: buildCronJobView(job as CronJobEntry) };
    return c.json(ok(data));
  });

  app.post("/api/cron/:id/run", async (c) => {
    if (!options.cronService) {
      return c.json(err("NOT_AVAILABLE", "cron service unavailable"), 503);
    }
    const id = decodeURIComponent(c.req.param("id"));
    const body = await readJson<CronRunRequest>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const existing = findCronJob(options.cronService, id);
    if (!existing) {
      return c.json(err("NOT_FOUND", `cron job not found: ${id}`), 404);
    }
    const executed = await options.cronService.runJob(id, Boolean(body.data.force));
    const after = findCronJob(options.cronService, id);
    const data: CronActionResult = {
      job: after ? buildCronJobView(after) : null,
      executed
    };
    return c.json(ok(data));
  });

  app.put("/api/config/runtime", async (c) => {
    const body = await readJson<RuntimeConfigUpdate>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = updateRuntime(options.configPath, body.data);
    if (body.data.agents?.defaults && Object.prototype.hasOwnProperty.call(body.data.agents.defaults, "contextTokens")) {
      options.publish({ type: "config.updated", payload: { path: "agents.defaults.contextTokens" } });
    }
    options.publish({ type: "config.updated", payload: { path: "agents.list" } });
    options.publish({ type: "config.updated", payload: { path: "bindings" } });
    options.publish({ type: "config.updated", payload: { path: "session" } });
    return c.json(ok(result));
  });

  app.post("/api/config/actions/:actionId/execute", async (c) => {
    const actionId = c.req.param("actionId");
    const body = await readJson<ConfigActionExecuteRequest>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = await executeConfigAction(options.configPath, actionId, body.data ?? {});
    if (!result.ok) {
      return c.json(err(result.code, result.message, result.details), 400);
    }
    return c.json(ok(result.data));
  });

  registerMarketplaceRoutes(app, options, marketplaceBaseUrl);

  return app;
}
