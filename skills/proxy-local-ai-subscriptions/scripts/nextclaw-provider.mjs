#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  discoverNextclawApi,
  fail,
  normalizeNextclawApi,
  normalizeOpenAiEndpoint,
  parseOptions,
  printJson,
  readApiKey,
  requestJson,
  requireOption,
  unwrapNextclaw,
} from "./local-subscription-proxy.utils.mjs";

const DEFAULT_PROVIDER_ID = "local-subscriptions";
const DEFAULT_DISPLAY_NAME = "Local AI Subscriptions";
const PROVIDER_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CLIPROXY_SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "cliproxy.mjs");

function help() {
  process.stdout.write(`Usage:
  node scripts/nextclaw-provider.mjs --endpoint <url> --api-key-file <path> --proxy-config <path> --service-manager <systemd|homebrew> [options]

Options:
  --nextclaw-api <url>       Explicit NextClaw API URL; otherwise use nextclaw status --json
  --nextclaw-command <path>  NextClaw CLI used for status discovery (default: nextclaw)
  --provider-id <id>         Custom provider id (default: ${DEFAULT_PROVIDER_ID})
  --display-name <name>      Provider display name (default: ${DEFAULT_DISPLAY_NAME})
  --model <raw-id>           Model used for connection test; defaults to a discovered Codex model
  --wire-api <wire>          chat, responses, or auto (default: chat)
  --proxy-binary <path>      CLIProxyAPI binary used by the durable readiness gate
  --service-name <name>      Managed service name (default: cliproxyapi.service/system formula)
  --systemctl <path>         systemctl command override for systemd environments
  --brew <path>              brew command override for Homebrew environments
  --replace-existing         Permit replacing a same-id provider that points elsewhere
`);
}

function assertDurableProxy(options, restartModel = null) {
  const command = restartModel ? "restart-smoke" : "check";
  const args = [
    CLIPROXY_SCRIPT,
    command,
    "--config", requireOption(options, "proxy-config"),
    "--endpoint", requireOption(options, "endpoint"),
    "--api-key-file", requireOption(options, "api-key-file"),
    "--service-manager", requireOption(options, "service-manager"),
  ];
  if (restartModel) args.push("--model", restartModel);
  const optionalMappings = [
    ["proxy-binary", "binary"],
    ["service-name", "service-name"],
    ["systemctl", "systemctl"],
    ["brew", "brew"],
  ];
  for (const [source, target] of optionalMappings) {
    if (options[source]) args.push(`--${target}`, options[source]);
  }
  if (options["allow-unaudited-version"] === true) args.push("--allow-unaudited-version");
  const result = spawnSync(process.execPath, args, {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`Durable CLIProxyAPI ${command} could not run: ${result.error.message}`);
  }
  if (result.status !== 0) {
    let detail = (result.stderr || result.stdout || "").trim();
    try {
      detail = JSON.parse(detail)?.error || detail;
    } catch {
      // Keep the original bounded diagnostic.
    }
    throw new Error(`Durable CLIProxyAPI ${command} failed: ${String(detail).slice(0, 1000)}`);
  }
  let readiness;
  try {
    readiness = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Durable CLIProxyAPI ${command} returned invalid JSON`);
  }
  if (readiness?.ok !== true || readiness?.lifecycle?.active !== true || readiness?.lifecycle?.enabled !== true) {
    throw new Error(`Durable CLIProxyAPI ${command} did not prove an active, enabled managed service`);
  }
  if (restartModel && (readiness?.restartVerified !== true || readiness?.smoke?.ok !== true)) {
    throw new Error("Durable CLIProxyAPI restart-smoke did not prove restart survival and a real model reply");
  }
  return readiness;
}

function providerUrl(apiBase, providerId = "") {
  const suffix = providerId ? `/${encodeURIComponent(providerId)}` : "";
  return `${apiBase}/providers${suffix}`;
}

function chooseModel(models, requestedModel) {
  if (requestedModel) {
    if (!models.includes(requestedModel)) {
      throw new Error(`Requested model was not returned by CLIProxyAPI: ${requestedModel}`);
    }
    return requestedModel;
  }
  return models.find((model) => /codex/i.test(model)) ?? models[0] ?? null;
}

function assertExistingProviderOwnership(existing, endpoint, replaceExisting) {
  if (!existing) return;
  const currentEndpoint = typeof existing.apiBase === "string"
    ? existing.apiBase.replace(/\/+$/, "")
    : "";
  if (currentEndpoint === endpoint) return;
  if (!replaceExisting) {
    throw new Error(
      `Provider ${existing.providerId || DEFAULT_PROVIDER_ID} already points to ${currentEndpoint || "an unknown endpoint"}; use --replace-existing only after explicit user approval`,
    );
  }
}

async function rollbackCreatedProvider(nextclawApi, providerId) {
  try {
    const payload = await requestJson(providerUrl(nextclawApi, providerId), { method: "DELETE" });
    unwrapNextclaw(payload, "Provider rollback");
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function main() {
  if (process.argv.includes("--help")) {
    help();
    return;
  }
  const options = parseOptions(process.argv.slice(2), {
    values: [
      "endpoint",
      "api-key-file",
      "nextclaw-api",
      "nextclaw-command",
      "provider-id",
      "display-name",
      "model",
      "wire-api",
      "proxy-config",
      "proxy-binary",
      "service-manager",
      "service-name",
      "systemctl",
      "brew",
    ],
    booleans: ["replace-existing", "allow-unaudited-version"],
  });
  const endpoint = normalizeOpenAiEndpoint(requireOption(options, "endpoint"));
  const apiKeyFile = resolve(requireOption(options, "api-key-file"));
  const apiKey = readApiKey(apiKeyFile);
  const readiness = assertDurableProxy(options);
  const providerId = options["provider-id"] || DEFAULT_PROVIDER_ID;
  if (!PROVIDER_ID_PATTERN.test(providerId)) {
    throw new Error("--provider-id must be a kebab-case identifier");
  }
  const displayName = options["display-name"] || DEFAULT_DISPLAY_NAME;
  const wireApi = options["wire-api"] || "chat";
  if (!new Set(["responses", "chat", "auto"]).has(wireApi)) {
    throw new Error("--wire-api must be responses, chat, or auto");
  }

  const proxyModels = Array.isArray(readiness.models) ? readiness.models : [];
  if (proxyModels.length === 0) {
    throw new Error("CLIProxyAPI returned no models; provider configuration was not changed");
  }
  const rawModel = chooseModel(proxyModels, options.model);
  if (!rawModel) {
    throw new Error("Unable to choose a test model; provider configuration was not changed");
  }
  const restartVerification = assertDurableProxy(options, rawModel);
  const nextclawApi = options["nextclaw-api"]
    ? normalizeNextclawApi(options["nextclaw-api"])
    : discoverNextclawApi(options["nextclaw-command"] || "nextclaw");
  const scopedModels = proxyModels.map((model) => `${providerId}/${model}`);
  const scopedModel = `${providerId}/${rawModel}`;
  const candidate = {
    providerId,
    providerType: null,
    displayName,
    enabled: false,
    apiKey,
    apiBase: endpoint,
    extraHeaders: null,
    wireApi,
    models: scopedModels,
    modelConfig: {},
  };

  const providersPayload = await requestJson(providerUrl(nextclawApi));
  const providers = unwrapNextclaw(providersPayload, "Provider list")?.providers ?? {};
  const existing = providers[providerId] ?? null;
  assertExistingProviderOwnership(existing, endpoint, options["replace-existing"] === true);

  let created = false;
  try {
    if (!existing) {
      const createPayload = await requestJson(providerUrl(nextclawApi), {
        method: "POST",
        body: candidate,
      });
      const createdProvider = unwrapNextclaw(createPayload, "Provider create");
      if (createdProvider?.providerId !== providerId) {
        throw new Error(`NextClaw created unexpected provider id: ${createdProvider?.providerId || "(missing)"}`);
      }
      created = true;
    }

    const testPayload = await requestJson(`${providerUrl(nextclawApi, providerId)}/test`, {
      method: "POST",
      body: { ...candidate, model: scopedModel },
      timeoutMs: 120_000,
    });
    const testResult = unwrapNextclaw(testPayload, "Provider connection test");
    if (testResult?.success !== true) {
      throw new Error(`Provider connection test failed: ${testResult?.message || "unknown error"}`);
    }

    const updatePayload = await requestJson(providerUrl(nextclawApi, providerId), {
      method: "PUT",
      body: { ...candidate, enabled: true },
    });
    const provider = unwrapNextclaw(updatePayload, "Provider enable");
    if (provider?.enabled !== true) {
      throw new Error("NextClaw did not report the provider as enabled");
    }

    printJson({
      ok: true,
      nextclawApi,
      providerId,
      displayName,
      endpoint,
      apiKeyFile,
      wireApi,
      created,
      enabled: true,
      rawModel,
      scopedModel,
      modelCount: scopedModels.length,
      durableService: readiness.lifecycle,
      restartVerified: restartVerification.restartVerified,
      test: {
        success: true,
        latencyMs: testResult.latencyMs,
        message: testResult.message,
      },
    });
  } catch (error) {
    const rollbackError = created ? await rollbackCreatedProvider(nextclawApi, providerId) : null;
    if (rollbackError) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${message}; rollback also failed: ${rollbackError}`);
    }
    throw error;
  }
}

main().catch(fail);
