import { ServiceAppLiveRuntimeService } from "@nextclaw-cli/cli/app/services/service-app-live-runtime.service.js";
import type {
  ServiceAppDevIssue,
  ServiceAppRestartCommandOptions,
  ServiceAppRestartReport,
} from "@nextclaw-cli/cli/app/types/service-app-dev.types.js";

export class AppRestartCommandController {
  constructor(private readonly liveRuntimeService = new ServiceAppLiveRuntimeService()) {}

  restart = async (
    appId: string,
    options: ServiceAppRestartCommandOptions,
  ): Promise<void> => {
    const report = await this.liveRuntimeService.restart(appId);
    process.stdout.write(options.json ? `${JSON.stringify(report, null, 2)}\n` : this.format(report));
    if (!report.ok) {
      process.exitCode = 1;
    }
  };

  private format = (report: ServiceAppRestartReport): string => {
    const heading = report.ok
      ? `NextClaw service app restart passed: ${report.target}\n`
      : `NextClaw service app restart failed: ${report.target || "(empty)"}\n`;
    const appLines = report.app
      ? [
        `App: ${report.app.title} (${report.app.id})`,
        `Status: ${report.app.status}`,
        report.app.lastError ? `Last error: ${report.app.lastError}` : "",
      ].filter(Boolean).join("\n")
      : "";
    return [
      heading,
      appLines,
      this.formatIssueSection("Errors", report.issues.filter((issue) => issue.severity === "error")),
      this.formatIssueSection("Warnings", report.issues.filter((issue) => issue.severity === "warning")),
    ].filter(Boolean).join("\n");
  };

  private formatIssueSection = (title: string, issues: ServiceAppDevIssue[]): string => {
    if (issues.length === 0) {
      return "";
    }
    const lines = issues.flatMap((issue) => [
      `- [${issue.code}] ${issue.message}`,
      issue.fixHint ? `  Fix: ${issue.fixHint}` : "",
    ].filter(Boolean));
    return `${title}:\n${lines.join("\n")}\n`;
  };
}
