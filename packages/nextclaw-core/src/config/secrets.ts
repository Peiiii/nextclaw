import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  ConfigSchema,
  SecretRefSchema,
  type Config,
  type SecretProviderConfig,
  type SecretRef,
  type SecretSource
} from "./schema.js";
import { isSensitiveConfigPath } from "./schema.hints.js";

const EXTRA_SENSITIVE_PATH_PATTERNS = [/authorization/i, /cookie/i, /bearer/i];
const DEFAULT_EXEC_TIMEOUT_MS = 5000;
const EXEC_MAX_BUFFER = 1024 * 1024;

type ResolveConfigSecretsOptions = {
  configPath?: string;
  env?: Record<string, string | undefined>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSensitivePath(path: string): boolean {
  if (isSensitiveConfigPath(path)) {
    return true;
  }
  return EXTRA_SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

function setPathValue(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split(".").filter(Boolean);
  if (!segments.length) {
    return;
  }
  let cursor: Record<string, unknown> = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const next = cursor[segment];
    if (!isRecord(next)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]] = value;
}

function getValueById(snapshot: Record<string, unknown>, id: string): unknown {
  if (Object.prototype.hasOwnProperty.call(snapshot, id)) {
    return snapshot[id];
  }
  const segments = id.split(".").filter(Boolean);
  if (!segments.length) {
    return undefined;
  }
  let cursor: unknown = snapshot;
  for (const segment of segments) {
    if (!isRecord(cursor)) {
      return undefined;
    }
    cursor = cursor[segment];
  }
  return cursor;
}

function toSecretString(value: unknown, context: string): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  throw new Error(`${context} must resolve to a string/number/boolean`);
}

function normalizeProviderAlias(ref: SecretRef, defaults: Config["secrets"]["defaults"]): string {
  const provider = ref.provider?.trim();
  if (provider) {
    return provider;
  }
  const configuredDefault = defaults[ref.source]?.trim();
  if (configuredDefault) {
    return configuredDefault;
  }
  return ref.source;
}

export function isSecretRefValue(value: unknown): value is SecretRef {
  return SecretRefSchema.safeParse(value).success;
}

export function hasSecretRef(config: Config, path: string): boolean {
  return Boolean(config.secrets.refs[path]);
}

function normalizeInlineNode(
  node: unknown,
  path: string,
  discoveredRefs: Record<string, SecretRef>
): unknown {
  if (isSecretRefValue(node) && path && isSensitivePath(path)) {
    discoveredRefs[path] = node;
    return "";
  }

  if (Array.isArray(node)) {
    return node.map((entry, index) => normalizeInlineNode(entry, `${path}.${index}`, discoveredRefs));
  }

  if (!isRecord(node)) {
    return node;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!path && key === "secrets") {
      output[key] = value;
      continue;
    }
    const nextPath = path ? `${path}.${key}` : key;
    output[key] = normalizeInlineNode(value, nextPath, discoveredRefs);
  }
  return output;
}

export function normalizeInlineSecretRefs(data: Record<string, unknown>): Record<string, unknown> {
  const discoveredRefs: Record<string, SecretRef> = {};
  const normalizedRoot = normalizeInlineNode(data, "", discoveredRefs);
  const output = isRecord(normalizedRoot) ? normalizedRoot : { ...data };

  const secretsRaw = isRecord(output.secrets) ? output.secrets : {};
  const existingRefsRaw = isRecord(secretsRaw.refs) ? secretsRaw.refs : {};
  output.secrets = {
    ...secretsRaw,
    refs: {
      ...existingRefsRaw,
      ...discoveredRefs
    }
  };

  return output;
}

class SecretRuntimeResolver {
  private readonly baseDir: string;
  private readonly env: Record<string, string | undefined>;
  private readonly fileSnapshots = new Map<string, Record<string, unknown>>();
  private readonly execSnapshots = new Map<string, Record<string, unknown>>();

  constructor(
    private readonly config: Config,
    options?: ResolveConfigSecretsOptions
  ) {
    this.baseDir = dirname(options?.configPath ?? "config.json");
    this.env = options?.env ?? process.env;
  }

  resolve(ref: SecretRef, configPath: string): string {
    const alias = normalizeProviderAlias(ref, this.config.secrets.defaults);
    const provider = this.resolveProvider(alias, ref.source);

    if (provider.source === "env") {
      const envKey = provider.prefix ? `${provider.prefix}${ref.id}` : ref.id;
      const raw = this.env[envKey];
      if (raw === undefined) {
        throw new Error(`secret ${configPath} unresolved: env key ${envKey} not found`);
      }
      return raw;
    }

    if (provider.source === "file") {
      const snapshot = this.getFileSnapshot(alias, provider);
      const resolved = getValueById(snapshot, ref.id);
      if (resolved === undefined) {
        throw new Error(`secret ${configPath} unresolved: id ${ref.id} not found in file provider ${alias}`);
      }
      return toSecretString(resolved, `secret ${configPath}`);
    }

    const snapshot = this.getExecSnapshot(alias, provider);
    const resolved = getValueById(snapshot, ref.id);
    if (resolved === undefined) {
      throw new Error(`secret ${configPath} unresolved: id ${ref.id} not found in exec provider ${alias}`);
    }
    return toSecretString(resolved, `secret ${configPath}`);
  }

  private resolveProvider(alias: string, source: SecretSource): SecretProviderConfig {
    const configured = this.config.secrets.providers[alias];
    if (!configured) {
      if (source === "env" && alias === "env") {
        return { source: "env" };
      }
      throw new Error(`secret provider ${alias} is not configured`);
    }
    if (configured.source !== source) {
      throw new Error(`secret provider ${alias} source mismatch: expected ${source}, got ${configured.source}`);
    }
    return configured;
  }

  private getFileSnapshot(alias: string, provider: Extract<SecretProviderConfig, { source: "file" }>): Record<string, unknown> {
    const cached = this.fileSnapshots.get(alias);
    if (cached) {
      return cached;
    }

    const filePath = resolve(this.baseDir, provider.path);
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      throw new Error(`file provider ${alias} must return a JSON object`);
    }

    this.fileSnapshots.set(alias, parsed);
    return parsed;
  }

  private getExecSnapshot(alias: string, provider: Extract<SecretProviderConfig, { source: "exec" }>): Record<string, unknown> {
    const cached = this.execSnapshots.get(alias);
    if (cached) {
      return cached;
    }

    const timeout = provider.timeoutMs ?? DEFAULT_EXEC_TIMEOUT_MS;
    const cwd = provider.cwd ? resolve(this.baseDir, provider.cwd) : this.baseDir;
    const result = spawnSync(provider.command, provider.args ?? [], {
      cwd,
      env: this.env,
      encoding: "utf-8",
      timeout,
      maxBuffer: EXEC_MAX_BUFFER
    });

    if (result.error) {
      throw new Error(`exec provider ${alias} failed: ${String(result.error)}`);
    }

    if (result.status !== 0) {
      const stderr = String(result.stderr ?? "").trim();
      throw new Error(`exec provider ${alias} exited with ${result.status}${stderr ? `: ${stderr}` : ""}`);
    }

    const stdout = String(result.stdout ?? "").trim();
    if (!stdout) {
      throw new Error(`exec provider ${alias} returned empty output`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      parsed = { value: stdout };
    }

    let snapshot: Record<string, unknown>;
    if (isRecord(parsed)) {
      snapshot = parsed;
    } else {
      snapshot = { value: parsed };
    }

    this.execSnapshots.set(alias, snapshot);
    return snapshot;
  }
}

export function resolveConfigSecrets(config: Config, options?: ResolveConfigSecretsOptions): Config {
  if (config.secrets.enabled === false) {
    return config;
  }

  const refs = config.secrets.refs;
  if (!refs || Object.keys(refs).length === 0) {
    return config;
  }

  const resolver = new SecretRuntimeResolver(config, options);
  const resolved = structuredClone(config) as unknown as Record<string, unknown>;

  for (const [path, ref] of Object.entries(refs)) {
    const normalizedPath = path.trim();
    if (!normalizedPath) {
      continue;
    }

    const root = normalizedPath.split(".")[0];
    if (!Object.prototype.hasOwnProperty.call(resolved, root)) {
      throw new Error(`secret ref path is invalid: ${normalizedPath}`);
    }

    const value = resolver.resolve(ref, normalizedPath);
    setPathValue(resolved, normalizedPath, value);
  }

  return ConfigSchema.parse(resolved);
}

export type { ResolveConfigSecretsOptions };
