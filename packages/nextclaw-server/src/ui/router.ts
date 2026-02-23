import { Hono } from "hono";
import { SkillsLoader, getWorkspacePathFromConfig } from "@nextclaw/core";
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
  updateRuntime,
  listSessions,
  getSessionHistory,
  patchSession,
  deleteSession
} from "./config.js";
import type {
  ConfigActionExecuteRequest,
  MarketplaceApiConfig,
  MarketplaceInstalledRecord,
  MarketplaceInstalledView,
  MarketplaceInstallRequest,
  MarketplaceInstallResult,
  MarketplaceManageRequest,
  MarketplaceManageResult,
  MarketplaceItemView,
  MarketplaceListView,
  MarketplaceRecommendationView,
  ProviderConfigUpdate,
  RuntimeConfigUpdate,
  SessionPatchUpdate,
  UiServerEvent
} from "./types.js";

type UiRouterOptions = {
  configPath: string;
  publish: (event: UiServerEvent) => void;
  marketplace?: MarketplaceApiConfig;
};

const DEFAULT_MARKETPLACE_API_BASE = "https://marketplace-api.nextclaw.io";

const NEXTCLAW_PLUGIN_NPM_PREFIX = "@nextclaw/channel-plugin-";
const BUILTIN_CHANNEL_PLUGIN_ID_PREFIX = "builtin-channel-";
const MARKETPLACE_REMOTE_PAGE_SIZE = 100;
const MARKETPLACE_REMOTE_MAX_PAGES = 20;

function normalizeChannelPluginNpmSpec(rawSpec: string): string {
  const spec = rawSpec.trim();
  if (!spec.startsWith(NEXTCLAW_PLUGIN_NPM_PREFIX)) {
    return spec;
  }

  const versionDelimiterIndex = spec.lastIndexOf("@");
  if (versionDelimiterIndex <= 0) {
    return spec;
  }

  const packageName = spec.slice(0, versionDelimiterIndex).trim();
  return packageName.startsWith(NEXTCLAW_PLUGIN_NPM_PREFIX) ? packageName : spec;
}

function resolvePluginCanonicalSpec(params: {
  pluginId: string;
  installSpec?: string;
}): string {
  const rawInstallSpec = typeof params.installSpec === "string" ? params.installSpec.trim() : "";
  if (rawInstallSpec.length > 0) {
    return normalizeChannelPluginNpmSpec(rawInstallSpec);
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
    const canonicalSpec = normalizeChannelPluginNpmSpec(record.spec).trim();
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

function collectMarketplaceInstalledView(options: UiRouterOptions): MarketplaceInstalledView {
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
  const pluginSpecSet = new Set(dedupedPluginRecords.map((record) => record.spec));

  const workspacePath = getWorkspacePathFromConfig(config);
  const skillsLoader = new SkillsLoader(workspacePath);
  const availableSkillSet = new Set(skillsLoader.listSkills(true).map((skill) => skill.name));
  const listedSkills = skillsLoader.listSkills(false);
  const skillSpecSet = new Set<string>();
  const skillRecords: MarketplaceInstalledRecord[] = listedSkills.map((skill) => {
    const enabled = availableSkillSet.has(skill.name);
    skillSpecSet.add(skill.name);
    return {
      type: "skill",
      id: skill.name,
      spec: skill.name,
      label: skill.name,
      source: skill.source,
      enabled,
      runtimeStatus: enabled ? "enabled" : "disabled"
    };
  });

  const records: MarketplaceInstalledRecord[] = [...dedupedPluginRecords, ...skillRecords].sort((left, right) => {
    if (left.type !== right.type) {
      return left.type.localeCompare(right.type);
    }
    return left.spec.localeCompare(right.spec);
  });

  return {
    total: records.length,
    pluginSpecs: Array.from(pluginSpecSet).sort((left, right) => left.localeCompare(right)),
    skillSpecs: Array.from(skillSpecSet).sort((left, right) => left.localeCompare(right)),
    records
  };
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
  const loader = new SkillsLoader(getWorkspacePathFromConfig(config));
  return new Set(loader.listSkills(false).map((skill) => skill.name));
}

function isSupportedMarketplaceItem(
  item: MarketplaceItemView | MarketplaceListView["items"][number],
  knownSkillNames: Set<string>
): boolean {
  if (item.type === "plugin") {
    return item.install.kind === "npm" && item.install.spec.startsWith(NEXTCLAW_PLUGIN_NPM_PREFIX);
  }

  return item.install.kind === "builtin" && knownSkillNames.has(item.install.spec);
}

async function fetchAllMarketplaceItems(params: {
  baseUrl: string;
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
      path: "/api/v1/items",
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

async function installMarketplaceItem(params: {
  options: UiRouterOptions;
  body: MarketplaceInstallRequest;
}): Promise<MarketplaceInstallResult> {
  const type = params.body.type;
  const spec = typeof params.body.spec === "string" ? params.body.spec.trim() : "";
  if ((type !== "plugin" && type !== "skill") || !spec) {
    throw new Error("INVALID_BODY:type and non-empty spec are required");
  }

  const installer = params.options.marketplace?.installer;
  if (!installer) {
    throw new Error("NOT_AVAILABLE:marketplace installer is not configured");
  }

  let result: { message: string; output?: string };
  if (type === "plugin") {
    if (!installer.installPlugin) {
      throw new Error("NOT_AVAILABLE:plugin installer is not configured");
    }
    result = await installer.installPlugin(spec);
  } else {
    if (!installer.installSkill) {
      throw new Error("NOT_AVAILABLE:skill installer is not configured");
    }
    result = await installer.installSkill({
      slug: spec,
      kind: params.body.kind,
      version: params.body.version,
      registry: params.body.registry,
      force: params.body.force
    });
  }

  params.options.publish({ type: "config.updated", payload: { path: type === "plugin" ? "plugins" : "skills" } });
  return {
    type,
    spec,
    message: result.message,
    output: result.output
  };
}

async function manageMarketplaceItem(params: {
  options: UiRouterOptions;
  body: MarketplaceManageRequest;
}): Promise<MarketplaceManageResult> {
  const type = params.body.type;
  const action = params.body.action;
  const targetId = typeof params.body.id === "string" && params.body.id.trim().length > 0
    ? params.body.id.trim()
    : typeof params.body.spec === "string" && params.body.spec.trim().length > 0
      ? params.body.spec.trim()
      : "";

  if ((type !== "plugin" && type !== "skill") || (action !== "enable" && action !== "disable" && action !== "uninstall") || !targetId) {
    throw new Error("INVALID_BODY:type, action and non-empty id/spec are required");
  }

  const installer = params.options.marketplace?.installer;
  if (!installer) {
    throw new Error("NOT_AVAILABLE:marketplace installer is not configured");
  }

  let result: { message: string; output?: string };

  if (type === "plugin") {
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
  } else {
    if (action !== "uninstall") {
      throw new Error("NOT_AVAILABLE:skill only supports uninstall action");
    }
    if (!installer.uninstallSkill) {
      throw new Error("NOT_AVAILABLE:skill uninstall is not configured");
    }
    result = await installer.uninstallSkill(targetId);
  }

  params.options.publish({ type: "config.updated", payload: { path: type === "plugin" ? "plugins" : "skills" } });

  return {
    type,
    action,
    id: targetId,
    message: result.message,
    output: result.output
  };
}

function registerMarketplaceRoutes(app: Hono, options: UiRouterOptions, marketplaceBaseUrl: string): void {
  app.get("/api/marketplace/installed", (c) => {
    return c.json(ok(collectMarketplaceInstalledView(options)));
  });

  app.get("/api/marketplace/items", async (c) => {
    const query = c.req.query();
    const result = await fetchAllMarketplaceItems({
      baseUrl: marketplaceBaseUrl,
      query: {
        q: query.q,
        type: query.type,
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
      .filter((item) => isSupportedMarketplaceItem(item, knownSkillNames));

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

  app.get("/api/marketplace/items/:slug", async (c) => {
    const slug = encodeURIComponent(c.req.param("slug"));
    const type = c.req.query("type");
    const result = await fetchMarketplaceData<MarketplaceItemView>({
      baseUrl: marketplaceBaseUrl,
      path: `/api/v1/items/${slug}`,
      query: {
        type
      }
    });

    if (!result.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", result.message), result.status as 500);
    }

    const knownSkillNames = collectKnownSkillNames(options);
    const sanitized = sanitizeMarketplaceItem(result.data);
    if (!isSupportedMarketplaceItem(sanitized, knownSkillNames)) {
      return c.json(err("NOT_FOUND", "marketplace item not supported by nextclaw"), 404);
    }

    return c.json(ok(sanitized));
  });

  app.get("/api/marketplace/recommendations", async (c) => {
    const query = c.req.query();
    const result = await fetchMarketplaceData<MarketplaceRecommendationView>({
      baseUrl: marketplaceBaseUrl,
      path: "/api/v1/recommendations",
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
      .filter((item) => isSupportedMarketplaceItem(item, knownSkillNames));

    return c.json(ok({
      ...result.data,
      total: filteredItems.length,
      items: filteredItems
    }));
  });

  app.post("/api/marketplace/install", async (c) => {
    const body = await readJson<MarketplaceInstallRequest>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    try {
      const payload = await installMarketplaceItem({ options, body: body.data });
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

  app.post("/api/marketplace/manage", async (c) => {
    const body = await readJson<MarketplaceManageRequest>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    try {
      const payload = await manageMarketplaceItem({ options, body: body.data });
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
