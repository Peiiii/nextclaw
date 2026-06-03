import { AppCheckService } from "@nextclaw-cli/cli/app/services/app-check.service.js";
import type { AppCheckCommandOptions, AppCheckIssue, AppCheckReport } from "@nextclaw-cli/cli/app/types/app-check.types.js";

export class AppCheckCommandController {
  constructor(private readonly appCheckService = new AppCheckService()) {}

  check = async (target: string, options: AppCheckCommandOptions): Promise<void> => {
    const report = await this.appCheckService.check(target);
    const output = options.json
      ? `${JSON.stringify(report, null, 2)}\n`
      : this.formatReport(report);
    process.stdout.write(output);
    if (!report.ok) {
      process.exitCode = 1;
    }
  };

  private formatReport = (report: AppCheckReport): string => {
    const heading = report.ok
      ? `NextClaw app check passed: ${report.target}\n`
      : `NextClaw app check failed: ${report.target}\n`;
    const errors = report.issues.filter((issue) => issue.severity === "error");
    const warnings = report.issues.filter((issue) => issue.severity === "warning");
    if (report.issues.length === 0) {
      return `${heading}\nNo issues found.\n`;
    }
    return [
      heading,
      this.formatIssueSection("Errors", errors),
      this.formatIssueSection("Warnings", warnings),
    ].filter(Boolean).join("\n");
  };

  private formatIssueSection = (title: string, issues: AppCheckIssue[]): string => {
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
