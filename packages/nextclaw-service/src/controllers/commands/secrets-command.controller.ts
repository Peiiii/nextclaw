import { readFileSync } from "node:fs";
import {
  buildReloadPlan,
  diffConfigPaths,
  getConfigPath,
  loadConfig,
  resolveConfigSecrets,
  saveConfig,
  type Config,
  type SecretRef,
  type SecretSource
} from "@nextclaw/core";
import { getAtConfigPath, parseRequiredConfigPath } from "@nextclaw-service/utils/config-path.utils.js";
import type { RequestRestartParams, SecretsApplyOptions, SecretsAuditOptions, SecretsConfigureOptions, SecretsReloadOptions } from "@nextclaw-service/types/cli.types.js";

type AuditItem = {
  path: string;
  source: SecretSource;
  provider: string;
  id: string;
  ok: boolean;
  detail: string;
};

const SECRET_SOURCES: SecretSource[] = ["env", "file", "exec"];

function normalizeSecretSource(value: unknown): SecretSource | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return SECRET_SOURCES.includes(normalized as SecretSource) ? (normalized as SecretSource) : null;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function parseTimeoutMs(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`invalid timeout: ${String(value)}`);
  }
  return Math.trunc(parsed);
}

function inferProviderAlias(config: Config, ref: SecretRef): string {
  const explicit = normalizeOptionalString(ref.provider);
  if (explicit) {
    return explicit;
  }
  const defaultAlias = normalizeOptionalString(config.secrets.defaults[ref.source]);
  if (defaultAlias) {
    return defaultAlias;
  }
  return ref.source;
}

function summarizeAudit(items: AuditItem[]): { total: number; ok: number; failed: number } {
  const ok = items.filter((item) => item.ok).length;
  return {
    total: items.length,
    ok,
    failed: items.length - ok
  };
}

function parseRefsPatch(raw: unknown): Record<string, SecretRef> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("refs patch must be an object");
  }

  const output: Record<string, SecretRef> = {};
  for (const [path, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`invalid ref for ${path}`);
    }
    const source = normalizeSecretSource((value as Record<string, unknown>).source);
    const id = normalizeOptionalString((value as Record<string, unknown>).id);
    const provider = normalizeOptionalString((value as Record<string, unknown>).provider);
    if (!source || !id) {
      throw new Error(`invalid ref for ${path}: source/id is required`);
    }
    output[path] = { source, ...(provider ? { provider } : {}), id };
  }
  return output;
}

function parseApplyFile(raw: string): {
  enabled?: boolean;
  defaults?: Config["secrets"]["defaults"];
  providers?: Config["secrets"]["providers"];
  refs?: Record<string, SecretRef>;
} {
  const data = JSON.parse(raw) as unknown;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("apply file must be an object");
  }
  const record = data as Record<string, unknown>;

  if (record.refs || record.providers || record.defaults || Object.prototype.hasOwnProperty.call(record, "enabled")) {
    const patch: {
      enabled?: boolean;
      defaults?: Config["secrets"]["defaults"];
      providers?: Config["secrets"]["providers"];
      refs?: Record<string, SecretRef>;
    } = {};

    if (Object.prototype.hasOwnProperty.call(record, "enabled")) {
      patch.enabled = Boolean(record.enabled);
    }
    if (record.defaults && typeof record.defaults === "object" && !Array.isArray(record.defaults)) {
      patch.defaults = record.defaults as Config["secrets"]["defaults"];
    }
    if (record.providers && typeof record.providers === "object" && !Array.isArray(record.providers)) {
      patch.providers = record.providers as Config["secrets"]["providers"];
    }
    if (record.refs) {
      patch.refs = parseRefsPatch(record.refs);
    }
    return patch;
  }

  return { refs: parseRefsPatch(record) };
}

export class SecretsCommands {
  constructor(
    private deps: {
      requestRestart: (params: RequestRestartParams) => Promise<void>;
    }
  ) {}

  audit = (opts: SecretsAuditOptions = {}): void => {
    const config = loadConfig();
    const configPath = getConfigPath();
    const refs = config.secrets.refs;
    const items: AuditItem[] = [];

    for (const [path, ref] of Object.entries(refs)) {
      const provider = inferProviderAlias(config, ref);
      const scopedConfig = structuredClone(config);
      scopedConfig.secrets.refs = { [path]: ref };

      try {
        const resolved = resolveConfigSecrets(scopedConfig, { configPath });
        const parsedPath = parseRequiredConfigPath(path);
        const target = getAtConfigPath(resolved as unknown as Record<string, unknown>, parsedPath);
        if (!target.found) {
          items.push({
            path,
            source: ref.source,
            provider,
            id: ref.id,
            ok: false,
            detail: "resolved but path not found"
          });
          continue;
        }
        const resolvedValue = target.value;
        const detail =
          typeof resolvedValue === "string"
            ? `resolved (length=${resolvedValue.length})`
            : `resolved (${typeof resolvedValue})`;
        items.push({
          path,
          source: ref.source,
          provider,
          id: ref.id,
          ok: true,
          detail
        });
      } catch (error) {
        items.push({
          path,
          source: ref.source,
          provider,
          id: ref.id,
          ok: false,
          detail: String(error)
        });
      }
    }

    const summary = summarizeAudit(items);
    if (opts.json) {
      console.log(JSON.stringify({ summary, items }, null, 2));
    } else if (!items.length) {
      console.log("No secret refs configured.");
    } else {
      for (const item of items) {
        const status = item.ok ? "OK" : "ERROR";
        console.log(
          `[${status}] ${item.path} <- ${item.source}:${item.provider}:${item.id} (${item.detail})`
        );
      }
      console.log(`Summary: total=${summary.total}, ok=${summary.ok}, failed=${summary.failed}`);
    }

    const strict = Boolean(opts.strict);
    if (strict && summary.failed > 0) {
      process.exitCode = 1;
    }
  };

  configure = async (opts: SecretsConfigureOptions): Promise<void> => {
    const alias = normalizeOptionalString(opts.provider);
    if (!alias) {
      throw new Error("provider alias is required");
    }

    const prevConfig = loadConfig();
    const nextConfig = structuredClone(prevConfig);
    const remove = Boolean(opts.remove);

    if (remove) {
      this.removeProvider(nextConfig, alias);
    } else {
      this.configureProvider(nextConfig, alias, opts);
    }

    resolveConfigSecrets(nextConfig, { configPath: getConfigPath() });
    saveConfig(nextConfig);
    await this.requestRestartForConfigDiff({
      prevConfig,
      nextConfig,
      reason: `secrets.configure ${alias}`,
      manualMessage: "Secrets provider updated. Restart the gateway if required."
    });

    if (opts.json) {
      console.log(JSON.stringify({ ok: true, providers: nextConfig.secrets.providers, defaults: nextConfig.secrets.defaults }, null, 2));
      return;
    }
    console.log(`Secrets provider ${remove ? "removed" : "configured"}: ${alias}`);
  };

  apply = async (opts: SecretsApplyOptions): Promise<void> => {
    const prevConfig = loadConfig();
    const nextConfig = structuredClone(prevConfig);

    this.applyEnabledPatch(nextConfig, opts);
    this.applyFilePatch(nextConfig, opts);
    this.applySingleRefPatch(nextConfig, opts);

    resolveConfigSecrets(nextConfig, { configPath: getConfigPath() });
    saveConfig(nextConfig);
    await this.requestRestartForConfigDiff({
      prevConfig,
      nextConfig,
      reason: "secrets.apply",
      manualMessage: "Secrets updated. Restart the gateway if required."
    });

    if (opts.json) {
      console.log(JSON.stringify({ ok: true, secrets: nextConfig.secrets }, null, 2));
      return;
    }
    console.log("Secrets applied.");
  };

  reload = async (opts: SecretsReloadOptions = {}): Promise<void> => {
    const config = loadConfig();
    const configPath = getConfigPath();
    resolveConfigSecrets(config, { configPath });
    saveConfig(config);

    if (opts.json) {
      console.log(JSON.stringify({ ok: true, message: "secrets reload signal emitted" }, null, 2));
      return;
    }
    console.log("Secrets reload signal emitted.");
  };

  private removeProvider = (config: Config, alias: string): void => {
    delete config.secrets.providers[alias];
    for (const source of SECRET_SOURCES) {
      if (config.secrets.defaults[source] === alias) {
        delete config.secrets.defaults[source];
      }
    }
  };

  private configureProvider = (config: Config, alias: string, opts: SecretsConfigureOptions): void => {
    const source = normalizeSecretSource(opts.source);
    if (!source) {
      throw new Error("source is required and must be one of env/file/exec");
    }
    config.secrets.providers[alias] = this.buildProviderConfig(source, opts);
    if (opts.setDefault) {
      config.secrets.defaults[source] = alias;
    }
  };

  private buildProviderConfig = (source: SecretSource, opts: SecretsConfigureOptions): Config["secrets"]["providers"][string] => {
    if (source === "env") {
      return {
        source,
        ...(normalizeOptionalString(opts.prefix) ? { prefix: normalizeOptionalString(opts.prefix) } : {})
      };
    }
    if (source === "file") {
      const path = normalizeOptionalString(opts.path);
      if (!path) {
        throw new Error("file source requires --path");
      }
      return { source, path, format: "json" };
    }
    const command = normalizeOptionalString(opts.command);
    if (!command) {
      throw new Error("exec source requires --command");
    }
    return {
      source,
      command,
      args: Array.isArray(opts.arg) ? opts.arg : [],
      ...(normalizeOptionalString(opts.cwd) ? { cwd: normalizeOptionalString(opts.cwd) } : {}),
      timeoutMs: parseTimeoutMs(opts.timeoutMs) ?? 5000
    };
  };

  private applyEnabledPatch = (config: Config, opts: SecretsApplyOptions): void => {
    const { disable, enable } = opts;
    if (enable && disable) {
      throw new Error("cannot set --enable and --disable at the same time");
    }
    if (enable || disable) {
      config.secrets.enabled = Boolean(enable);
    }
  };

  private applyFilePatch = (config: Config, opts: SecretsApplyOptions): void => {
    if (!opts.file) {
      return;
    }
    const { defaults, providers, refs } = parseApplyFile(readFileSync(opts.file, "utf-8"));
    if (defaults) config.secrets.defaults = defaults;
    if (providers) config.secrets.providers = providers;
    if (refs) config.secrets.refs = { ...config.secrets.refs, ...refs };
  };

  private applySingleRefPatch = (config: Config, opts: SecretsApplyOptions): void => {
    if (!opts.path) {
      if (opts.remove && !opts.file) {
        throw new Error("--remove requires --path");
      }
      return;
    }
    const path = opts.path.trim();
    if (!path) {
      throw new Error("path is empty");
    }
    if (opts.remove) {
      delete config.secrets.refs[path];
      return;
    }
    const source = normalizeSecretSource(opts.source);
    const id = normalizeOptionalString(opts.id);
    if (!source || !id) {
      throw new Error("apply single ref requires --source and --id");
    }
    const provider = normalizeOptionalString(opts.provider);
    config.secrets.refs[path] = {
      source,
      id,
      ...(provider ? { provider } : {})
    };
  };

  private requestRestartForConfigDiff = async (params: {
    prevConfig: Config;
    nextConfig: Config;
    reason: string;
    manualMessage: string;
  }): Promise<void> => {
    const { manualMessage, nextConfig, prevConfig, reason } = params;
    const changedPaths = diffConfigPaths(prevConfig, nextConfig);
    if (!changedPaths.length) {
      return;
    }
    const plan = buildReloadPlan(changedPaths);
    if (plan.restartRequired.length === 0) {
      return;
    }
    await this.deps.requestRestart({
      changedPaths: plan.restartRequired,
      mode: "notify",
      reason: `${reason} (${plan.restartRequired.join(", ")})`,
      manualMessage
    });
  };
}
