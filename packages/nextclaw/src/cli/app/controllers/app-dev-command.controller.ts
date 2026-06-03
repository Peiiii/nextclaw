import { ServiceAppDevService } from "@nextclaw-cli/cli/app/services/service-app-dev.service.js";
import type {
  ServiceAppDevCommandOptions,
  ServiceAppDevIssue,
  ServiceAppDevReport,
} from "@nextclaw-cli/cli/app/types/service-app-dev.types.js";

export class AppDevCommandController {
  constructor(private readonly serviceAppDevService = new ServiceAppDevService()) {}

  dev = async (target: string, options: ServiceAppDevCommandOptions): Promise<void> => {
    const report = await this.serviceAppDevService.inspect(target);
    process.stdout.write(options.json ? `${JSON.stringify(report, null, 2)}\n` : this.format(report));
    if (!report.ok) {
      process.exitCode = 1;
    }
  };

  private format = (report: ServiceAppDevReport): string => {
    const heading = report.ok
      ? `NextClaw service app dev passed: ${report.target}\n`
      : `NextClaw service app dev failed: ${report.target}\n`;
    const appLines = report.app
      ? [
        `App: ${report.app.title} (${report.app.id})`,
        `Status: ${report.app.status}`,
        report.app.lastError ? `Last error: ${report.app.lastError}` : "",
      ].filter(Boolean).join("\n")
      : "";
    const actions = report.actions.length
      ? `Actions:\n${report.actions.map((action) =>
        `- ${action.id} [${action.runtimeState ?? "declared"}] risk=${action.risk}`,
      ).join("\n")}\n`
      : "Actions: none\n";
    return [
      heading,
      appLines,
      actions,
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
