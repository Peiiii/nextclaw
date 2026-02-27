import { createServer as createNetServer } from "node:net";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  APP_NAME,
  getConfigPath,
  getDataDir,
  getWorkspacePath,
  hasSecretRef,
  loadConfig,
  PROVIDERS
} from "@nextclaw/core";
import {
  clearServiceState,
  isProcessRunning,
  readServiceState,
  resolveServiceLogPath,
  resolveUiApiBase,
  resolveUiConfig
} from "../utils.js";
import type {
  DoctorCommandOptions,
  HealthProbe,
  RuntimeStatusReport,
  StatusCommandOptions
} from "../types.js";

export class DiagnosticsCommands {
  constructor(private deps: { logo: string }) {}

  async status(opts: StatusCommandOptions = {}): Promise<void> {
    const report = await this.collectRuntimeStatus({
      verbose: Boolean(opts.verbose),
      fix: Boolean(opts.fix)
    });

    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = report.exitCode;
      return;
    }

    console.log(`${this.deps.logo} ${APP_NAME} Status`);
    console.log(`Level: ${report.level}`);
    console.log(`Generated: ${report.generatedAt}`);
    console.log("");

    const processLabel = report.process.running
      ? `running (PID ${report.process.pid})`
      : report.process.staleState
        ? "stale-state"
        : "stopped";

    console.log(`Process: ${processLabel}`);
    console.log(`State file: ${report.serviceStatePath} ${report.serviceStateExists ? "✓" : "✗"}`);
    if (report.process.startedAt) {
      console.log(`Started: ${report.process.startedAt}`);
    }

    console.log(`Managed health: ${report.health.managed.state} (${report.health.managed.detail})`);
    if (!report.process.running) {
      console.log(`Configured health: ${report.health.configured.state} (${report.health.configured.detail})`);
    }

    console.log(`UI: ${report.endpoints.uiUrl ?? report.endpoints.configuredUiUrl}`);
    console.log(`API: ${report.endpoints.apiUrl ?? report.endpoints.configuredApiUrl}`);
    console.log(`Config: ${report.configPath} ${report.configExists ? "✓" : "✗"}`);
    console.log(`Workspace: ${report.workspacePath} ${report.workspaceExists ? "✓" : "✗"}`);
    console.log(`Model: ${report.model}`);

    for (const provider of report.providers) {
      console.log(`${provider.name}: ${provider.configured ? "✓" : "not set"}${provider.detail ? ` (${provider.detail})` : ""}`);
    }

    if (report.fixActions.length > 0) {
      console.log("");
      console.log("Fix actions:");
      for (const action of report.fixActions) {
        console.log(`- ${action}`);
      }
    }

    if (report.issues.length > 0) {
      console.log("");
      console.log("Issues:");
      for (const issue of report.issues) {
        console.log(`- ${issue}`);
      }
    }

    if (report.recommendations.length > 0) {
      console.log("");
      console.log("Recommendations:");
      for (const recommendation of report.recommendations) {
        console.log(`- ${recommendation}`);
      }
    }

    if (opts.verbose && report.logTail.length > 0) {
      console.log("");
      console.log("Recent logs:");
      for (const line of report.logTail) {
        console.log(line);
      }
    }

    process.exitCode = report.exitCode;
  }

  async doctor(opts: DoctorCommandOptions = {}): Promise<void> {
    const report = await this.collectRuntimeStatus({
      verbose: Boolean(opts.verbose),
      fix: Boolean(opts.fix)
    });

    const checkPort = await this.checkPortAvailability({
      host: report.process.running ? (report.endpoints.uiUrl ? new URL(report.endpoints.uiUrl).hostname : "127.0.0.1") : "127.0.0.1",
      port: (() => {
        try {
          const base = report.process.running && report.endpoints.uiUrl ? report.endpoints.uiUrl : report.endpoints.configuredUiUrl;
          return Number(new URL(base).port || 80);
        } catch {
          return 18791;
        }
      })()
    });

    const providerConfigured = report.providers.some((provider) => provider.configured);

    const checks = [
      {
        name: "config-file",
        status: report.configExists ? "pass" : "fail",
        detail: report.configPath
      },
      {
        name: "workspace-dir",
        status: report.workspaceExists ? "pass" : "warn",
        detail: report.workspacePath
      },
      {
        name: "service-state",
        status: report.process.staleState ? "fail" : report.process.running ? "pass" : "warn",
        detail: report.process.running
          ? `PID ${report.process.pid}`
          : report.process.staleState
            ? "state exists but process is not running"
            : "service not running"
      },
      {
        name: "service-health",
        status: report.process.running
          ? report.health.managed.state === "ok"
            ? "pass"
            : "fail"
          : report.health.configured.state === "ok"
            ? "warn"
            : "warn",
        detail: report.process.running
          ? `${report.health.managed.state}: ${report.health.managed.detail}`
          : `${report.health.configured.state}: ${report.health.configured.detail}`
      },
      {
        name: "ui-port-availability",
        status: report.process.running ? "pass" : checkPort.available ? "pass" : "fail",
        detail: report.process.running ? "managed by running service" : checkPort.available ? "available" : checkPort.detail
      },
      {
        name: "provider-config",
        status: providerConfigured ? "pass" : "warn",
        detail: providerConfigured ? "at least one provider configured" : "no provider api key configured"
      }
    ] as const;

    const failed = checks.filter((check) => check.status === "fail");
    const warned = checks.filter((check) => check.status === "warn");
    const exitCode = failed.length > 0 ? 1 : warned.length > 0 ? 1 : 0;

    if (opts.json) {
      console.log(
        JSON.stringify(
          {
            generatedAt: report.generatedAt,
            checks,
            status: report,
            exitCode
          },
          null,
          2
        )
      );
      process.exitCode = exitCode;
      return;
    }

    console.log(`${this.deps.logo} ${APP_NAME} Doctor`);
    console.log(`Generated: ${report.generatedAt}`);
    console.log("");

    for (const check of checks) {
      const icon = check.status === "pass" ? "✓" : check.status === "warn" ? "!" : "✗";
      console.log(`${icon} ${check.name}: ${check.detail}`);
    }

    if (report.recommendations.length > 0) {
      console.log("");
      console.log("Recommendations:");
      for (const recommendation of report.recommendations) {
        console.log(`- ${recommendation}`);
      }
    }

    if (opts.verbose && report.logTail.length > 0) {
      console.log("");
      console.log("Recent logs:");
      for (const line of report.logTail) {
        console.log(line);
      }
    }

    process.exitCode = exitCode;
  }

  private async collectRuntimeStatus(params: { verbose: boolean; fix: boolean }): Promise<RuntimeStatusReport> {
    const configPath = getConfigPath();
    const config = loadConfig();
    const workspacePath = getWorkspacePath(config.agents.defaults.workspace);
    const serviceStatePath = resolve(getDataDir(), "run", "service.json");

    const fixActions: string[] = [];

    let serviceState = readServiceState();
    if (params.fix && serviceState && !isProcessRunning(serviceState.pid)) {
      clearServiceState();
      fixActions.push("Cleared stale service state file.");
      serviceState = readServiceState();
    }

    const managedByState = Boolean(serviceState);
    const running = Boolean(serviceState && isProcessRunning(serviceState.pid));
    const staleState = Boolean(serviceState && !running);

    const configuredUi = resolveUiConfig(config, { enabled: true, host: config.ui.host, port: config.ui.port });
    const configuredUiUrl = resolveUiApiBase(configuredUi.host, configuredUi.port);
    const configuredApiUrl = `${configuredUiUrl}/api`;

    const managedUiUrl = serviceState?.uiUrl ?? null;
    const managedApiUrl = serviceState?.apiUrl ?? null;

    const managedHealth: HealthProbe = running && managedApiUrl
      ? await this.probeApiHealth(`${managedApiUrl}/health`)
      : { state: "unreachable", detail: "service not running" };

    const configuredHealth = await this.probeApiHealth(`${configuredApiUrl}/health`, 900);

    const orphanSuspected = !running && configuredHealth.state === "ok";

    const providers = PROVIDERS.map((spec) => {
      const provider = (config.providers as Record<string, { apiKey?: string; apiBase?: string } | undefined>)[spec.name];
      const apiKeyRefSet = hasSecretRef(config, `providers.${spec.name}.apiKey`);
      if (!provider) {
        return { name: spec.displayName ?? spec.name, configured: false, detail: "missing config" };
      }
      if (spec.isLocal) {
        return {
          name: spec.displayName ?? spec.name,
          configured: Boolean(provider.apiBase),
          detail: provider.apiBase ? provider.apiBase : "apiBase not set"
        };
      }
      return {
        name: spec.displayName ?? spec.name,
        configured: Boolean(provider.apiKey) || apiKeyRefSet,
        detail: provider.apiKey ? "apiKey set" : apiKeyRefSet ? "apiKey ref set" : "apiKey not set"
      };
    });

    const issues: string[] = [];
    const recommendations: string[] = [];

    if (!existsSync(configPath)) {
      issues.push("Config file is missing.");
      recommendations.push(`Run ${APP_NAME} init to create config files.`);
    }

    if (!existsSync(workspacePath)) {
      issues.push("Workspace directory does not exist.");
      recommendations.push(`Run ${APP_NAME} init to create workspace templates.`);
    }

    if (staleState) {
      issues.push("Service state is stale (state exists but process is not running).");
      recommendations.push(`Run ${APP_NAME} status --fix to clean stale state.`);
    }

    if (running && managedHealth.state !== "ok") {
      issues.push(`Managed service health check failed: ${managedHealth.detail}`);
      recommendations.push(`Check logs at ${serviceState?.logPath ?? resolveServiceLogPath()}.`);
    }

    if (!running) {
      recommendations.push(`Run ${APP_NAME} start to launch the service.`);
    }

    if (orphanSuspected) {
      issues.push("A service appears healthy on configured API endpoint, but state is missing/stale.");
      recommendations.push("Another process may be occupying the UI port; stop it or use --ui-port with a free port.");
    }

    if (!providers.some((provider) => provider.configured)) {
      recommendations.push("Configure at least one provider API key in UI or config before expecting agent replies.");
    }

    const logTail = params.verbose
      ? this.readLogTail((serviceState?.logPath ?? resolveServiceLogPath()), 25)
      : [];

    const level: RuntimeStatusReport["level"] = running
      ? managedHealth.state === "ok"
        ? issues.length > 0
          ? "degraded"
          : "healthy"
        : "degraded"
      : "stopped";

    const exitCode: RuntimeStatusReport["exitCode"] = level === "healthy" ? 0 : level === "degraded" ? 1 : 2;

    return {
      generatedAt: new Date().toISOString(),
      configPath,
      configExists: existsSync(configPath),
      workspacePath,
      workspaceExists: existsSync(workspacePath),
      model: config.agents.defaults.model,
      providers,
      serviceStatePath,
      serviceStateExists: existsSync(serviceStatePath),
      fixActions,
      process: {
        managedByState,
        pid: serviceState?.pid ?? null,
        running,
        staleState,
        orphanSuspected,
        startedAt: serviceState?.startedAt ?? null
      },
      endpoints: {
        uiUrl: managedUiUrl,
        apiUrl: managedApiUrl,
        configuredUiUrl,
        configuredApiUrl
      },
      health: {
        managed: managedHealth,
        configured: configuredHealth
      },
      issues,
      recommendations,
      logTail,
      level,
      exitCode
    };
  }

  private async probeApiHealth(url: string, timeoutMs = 1500): Promise<HealthProbe> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal
      });
      if (!response.ok) {
        return { state: "invalid-response", detail: `HTTP ${response.status}` };
      }
      const payload = (await response.json()) as { ok?: boolean; data?: { status?: string } };
      if (payload?.ok === true && payload?.data?.status === "ok") {
        return { state: "ok", detail: "health endpoint returned ok", payload };
      }
      return { state: "invalid-response", detail: "unexpected health payload", payload };
    } catch (error) {
      return { state: "unreachable", detail: String(error) };
    } finally {
      clearTimeout(timer);
    }
  }

  private readLogTail(path: string, maxLines = 25): string[] {
    if (!existsSync(path)) {
      return [];
    }
    try {
      const lines = readFileSync(path, "utf-8").split(/\r?\n/).filter(Boolean);
      if (lines.length <= maxLines) {
        return lines;
      }
      return lines.slice(lines.length - maxLines);
    } catch {
      return [];
    }
  }

  private async checkPortAvailability(params: { host: string; port: number }): Promise<{ available: boolean; detail: string }> {
    return await new Promise((resolve) => {
      const server = createNetServer();
      server.once("error", (error) => {
        resolve({
          available: false,
          detail: `bind failed on ${params.host}:${params.port} (${String(error)})`
        });
      });
      server.listen(params.port, params.host, () => {
        server.close(() => {
          resolve({
            available: true,
            detail: `bind ok on ${params.host}:${params.port}`
          });
        });
      });
    });
  }
}
