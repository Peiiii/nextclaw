import { APP_NAME } from "@nextclaw/core";
import type { RuntimeStatusReport } from "../../shared/types/cli.types.js";

export type DoctorCheck = {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

export function printStatusReport(params: {
  logo: string;
  report: RuntimeStatusReport;
  verbose: boolean;
}): void {
  const { logo, report, verbose } = params;
  console.log(`${logo} ${APP_NAME} Status`);
  console.log(`Level: ${report.level}`);
  console.log(`Generated: ${report.generatedAt}`);
  console.log("");
  printProcessSection(report);
  printEndpointSection(report);
  printProviderSection(report);
  printTextList("Fix actions", report.fixActions);
  printTextList("Issues", report.issues);
  printTextList("Recommendations", report.recommendations);

  if (verbose && report.logTail.length > 0) {
    console.log("");
    console.log("Recent logs:");
    for (const line of report.logTail) {
      console.log(line);
    }
  }
}

function printProcessSection(report: RuntimeStatusReport): void {
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
}

function printEndpointSection(report: RuntimeStatusReport): void {
  console.log(`UI: ${report.endpoints.uiUrl ?? report.endpoints.configuredUiUrl}`);
  console.log(`API: ${report.endpoints.apiUrl ?? report.endpoints.configuredApiUrl}`);
  console.log(`Remote: ${report.remote.configuredEnabled ? "enabled" : "disabled"}${report.remote.runtime ? ` (${report.remote.runtime.state})` : ""}`);
  if (report.remote.runtime?.deviceName) {
    console.log(`Remote device: ${report.remote.runtime.deviceName}`);
  }
  if (report.remote.runtime?.platformBase) {
    console.log(`Remote platform: ${report.remote.runtime.platformBase}`);
  }
  if (report.remote.runtime?.lastError) {
    console.log(`Remote error: ${report.remote.runtime.lastError}`);
  }
  console.log(`Config: ${report.configPath} ${report.configExists ? "✓" : "✗"}`);
  console.log(`Workspace: ${report.workspacePath} ${report.workspaceExists ? "✓" : "✗"}`);
  console.log(`Model: ${report.model}`);
}

function printProviderSection(report: RuntimeStatusReport): void {
  for (const provider of report.providers) {
    console.log(`${provider.name}: ${provider.configured ? "✓" : "not set"}${provider.detail ? ` (${provider.detail})` : ""}`);
  }
}

export function printDoctorReport(params: {
  logo: string;
  generatedAt: string;
  checks: DoctorCheck[];
  recommendations: string[];
  verbose: boolean;
  logTail: string[];
}): void {
  console.log(`${params.logo} ${APP_NAME} Doctor`);
  console.log(`Generated: ${params.generatedAt}`);
  console.log("");

  for (const check of params.checks) {
    const icon = check.status === "pass" ? "✓" : check.status === "warn" ? "!" : "✗";
    console.log(`${icon} ${check.name}: ${check.detail}`);
  }

  printTextList("Recommendations", params.recommendations);

  if (params.verbose && params.logTail.length > 0) {
    console.log("");
    console.log("Recent logs:");
    for (const line of params.logTail) {
      console.log(line);
    }
  }
}

function printTextList(title: string, items: string[]): void {
  if (items.length === 0) {
    return;
  }
  console.log("");
  console.log(`${title}:`);
  for (const item of items) {
    console.log(`- ${item}`);
  }
}
