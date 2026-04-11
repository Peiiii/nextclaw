import { createServer as createNetServer } from "node:net";
import { existsSync, readFileSync } from "node:fs";
import {
  APP_NAME,
  getConfigPath,
  getWorkspacePath,
  hasSecretRef,
  loadConfig,
  resolveAppLogPath
} from "@nextclaw/core";
import { listBuiltinProviders } from "@nextclaw/runtime";
import {
  isProcessRunning,
  resolveUiApiBase,
  resolveUiConfig
} from "../utils.js";
import {
  managedServiceStateStore,
  type ManagedServiceState
} from "../runtime-state/managed-service-state.store.js";
import { printDoctorReport, printStatusReport, type DoctorCheck } from "./diagnostics-support/diagnostics-render.js";
import { resolveNextclawRemoteStatusSnapshot } from "./remote-support/remote-runtime-support.js";
import type {
  DoctorCommandOptions,
  HealthProbe,
  RuntimeStatusReport,
  StatusCommandOptions
} from "../types.js";

export class DiagnosticsCommands {
  constructor(private deps: { logo: string }) {}

  readonly status = async (opts: StatusCommandOptions = {}): Promise<void> => {
    const report = await this.collectRuntimeStatus({
      verbose: Boolean(opts.verbose),
      fix: Boolean(opts.fix)
    });

    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = 0;
      return;
    }
    printStatusReport({ logo: this.deps.logo, report, verbose: Boolean(opts.verbose) });
    process.exitCode = 0;
  };

  readonly doctor = async (opts: DoctorCommandOptions = {}): Promise<void> => {
    const report = await this.collectRuntimeStatus({
      verbose: Boolean(opts.verbose),
      fix: Boolean(opts.fix)
    });

    const checkPort = await this.checkPortAvailability(this.resolveDoctorPortCheckTarget(report));
    const checks = this.buildDoctorChecks(report, checkPort);
    const exitCode = this.resolveDoctorExitCode(checks);

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

    printDoctorReport({
      logo: this.deps.logo,
      generatedAt: report.generatedAt,
      checks,
      recommendations: report.recommendations,
      verbose: Boolean(opts.verbose),
      logTail: report.logTail
    });
    process.exitCode = exitCode;
  };

  private readonly resolveDoctorPortCheckTarget = (report: RuntimeStatusReport): { host: string; port: number } => {
    const host = report.process.running && report.endpoints.uiUrl
      ? new URL(report.endpoints.uiUrl).hostname
      : "127.0.0.1";
    try {
      const base = report.process.running && report.endpoints.uiUrl
        ? report.endpoints.uiUrl
        : report.endpoints.configuredUiUrl;
      return {
        host,
        port: Number(new URL(base).port || 80)
      };
    } catch {
      return {
        host,
        port: 55667
      };
    }
  };

  private readonly buildDoctorChecks = (
    report: RuntimeStatusReport,
    checkPort: { available: boolean; detail: string }
  ): DoctorCheck[] => {
    const providerConfigured = report.providers.some((provider) => provider.configured);
    return [
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
          : "warn",
        detail: report.process.running
          ? `${report.health.managed.state}: ${report.health.managed.detail}`
          : `${report.health.configured.state}: ${report.health.configured.detail}`
      },
      {
        name: "ui-port-availability",
        status: report.process.running || checkPort.available ? "pass" : "fail",
        detail: report.process.running ? "managed by running service" : checkPort.available ? "available" : checkPort.detail
      },
      {
        name: "provider-config",
        status: providerConfigured ? "pass" : "warn",
        detail: providerConfigured ? "at least one provider configured" : "no provider api key configured"
      }
    ] as const;
  };

  private readonly resolveDoctorExitCode = (checks: DoctorCheck[]): number => {
    if (checks.some((check) => check.status === "fail")) {
      return 1;
    }
    if (checks.some((check) => check.status === "warn")) {
      return 1;
    }
    return 0;
  };

  private readonly collectRuntimeStatus = async (params: { verbose: boolean; fix: boolean }): Promise<RuntimeStatusReport> => {
    const configPath = getConfigPath();
    const config = loadConfig();
    const workspacePath = getWorkspacePath(config.agents.defaults.workspace);
    const serviceStatePath = managedServiceStateStore.path;

    const fixActions: string[] = [];

    let serviceState = managedServiceStateStore.read();
    if (params.fix && serviceState && !isProcessRunning(serviceState.pid)) {
      managedServiceStateStore.clear();
      fixActions.push("Cleared stale service state file.");
      serviceState = managedServiceStateStore.read();
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
    const remote = resolveNextclawRemoteStatusSnapshot(config);
    const orphanSuspected = !running && configuredHealth.state === "ok";
    const providers = this.listProviderStatuses(config);

    const issues: string[] = [];
    const recommendations: string[] = [];

    this.collectRuntimeIssues({
      configPath,
      workspacePath,
      staleState,
      running,
      managedHealth,
      serviceState,
      orphanSuspected,
      providers,
      issues,
      recommendations
    });

    const logTail = params.verbose
      ? this.readLogTail((serviceState?.logPath ?? resolveAppLogPath("service")), 25)
      : [];

    const level: RuntimeStatusReport["level"] = running
      ? managedHealth.state === "ok"
        ? issues.length > 0
          ? "degraded"
          : "healthy"
        : "degraded"
      : "stopped";

    const exitCode: RuntimeStatusReport["exitCode"] = 0;

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
      remote,
      level,
      exitCode
    };
  };

  private readonly probeApiHealth = async (url: string, timeoutMs = 1500): Promise<HealthProbe> => {
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
  };

  private readonly listProviderStatuses = (config: ReturnType<typeof loadConfig>): RuntimeStatusReport["providers"] => {
    return listBuiltinProviders().map((spec) => {
      const provider = (config.providers as Record<string, { enabled?: boolean; apiKey?: string; apiBase?: string } | undefined>)[spec.name];
      const apiKeyRefSet = hasSecretRef(config, `providers.${spec.name}.apiKey`);
      if (!provider) {
        return { name: spec.displayName ?? spec.name, configured: false, detail: "missing config" };
      }
      if (provider.enabled === false) {
        return { name: spec.displayName ?? spec.name, configured: false, detail: "disabled" };
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
  };

  private readonly collectRuntimeIssues = (params: {
    configPath: string;
    workspacePath: string;
    staleState: boolean;
    running: boolean;
    managedHealth: HealthProbe;
    serviceState: ManagedServiceState | null;
    orphanSuspected: boolean;
    providers: RuntimeStatusReport["providers"];
    issues: string[];
    recommendations: string[];
  }): void => {
    if (!existsSync(params.configPath)) {
      params.issues.push("Config file is missing.");
      params.recommendations.push(`Run ${APP_NAME} init to create config files.`);
    }
    if (!existsSync(params.workspacePath)) {
      params.issues.push("Workspace directory does not exist.");
      params.recommendations.push(`Run ${APP_NAME} init to create workspace templates.`);
    }
    if (params.staleState) {
      params.issues.push("Service state is stale (state exists but process is not running).");
      params.recommendations.push(`Run ${APP_NAME} status --fix to clean stale state.`);
    }
    if (params.running && params.managedHealth.state !== "ok") {
      params.issues.push(`Managed service health check failed: ${params.managedHealth.detail}`);
      params.recommendations.push(`Check logs at ${params.serviceState?.logPath ?? resolveAppLogPath("service")}.`);
    }
    if (params.running && params.serviceState?.startupState === "degraded" && params.managedHealth.state !== "ok") {
      const startupHint = params.serviceState.startupLastProbeError ? ` (${params.serviceState.startupLastProbeError})` : "";
      params.issues.push(`Service is in degraded startup state${startupHint}.`);
      params.recommendations.push(`Wait and re-check ${APP_NAME} status; if it does not recover, inspect logs and restart.`);
    }
    if (!params.running) {
      params.recommendations.push(`Run ${APP_NAME} start to launch the service.`);
    }
    if (params.orphanSuspected) {
      params.issues.push("A service appears healthy on configured API endpoint, but state is missing/stale.");
      params.recommendations.push("Another process may be occupying the UI port; stop it or use --ui-port with a free port.");
    }
    if (!params.providers.some((provider) => provider.configured)) {
      params.recommendations.push("Configure at least one provider API key in UI or config before expecting agent replies.");
    }
  };

  private readonly readLogTail = (path: string, maxLines = 25): string[] => {
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
  };

  private readonly checkPortAvailability = async (params: { host: string; port: number }): Promise<{ available: boolean; detail: string }> => {
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
  };
}
