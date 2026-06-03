import { ServiceAppDevService } from "@nextclaw-cli/cli/app/services/service-app-dev.service.js";
import type {
  ServiceAppCallCommandOptions,
  ServiceAppCallReport,
  ServiceAppDevIssue,
} from "@nextclaw-cli/cli/app/types/service-app-dev.types.js";

export class AppCallCommandController {
  constructor(private readonly serviceAppDevService = new ServiceAppDevService()) {}

  call = async (
    target: string,
    actionName: string,
    options: ServiceAppCallCommandOptions,
  ): Promise<void> => {
    const input = this.parseInput(options.input);
    if (!input.ok) {
      this.writeInputError(input.message, Boolean(options.json));
      process.exitCode = 1;
      return;
    }
    const report = await this.serviceAppDevService.call(target, actionName, input.value);
    process.stdout.write(options.json ? `${JSON.stringify(report, null, 2)}\n` : this.format(report));
    if (!report.ok) {
      process.exitCode = 1;
    }
  };

  private parseInput = (
    raw: string | undefined,
  ): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } => {
    if (!raw) {
      return { ok: true, value: {} };
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {
          ok: false,
          message: "--input must be a JSON object.",
        };
      }
      return { ok: true, value: parsed as Record<string, unknown> };
    } catch (error) {
      return {
        ok: false,
        message: `--input is not valid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  };

  private writeInputError = (message: string, json: boolean): void => {
    if (json) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        issues: [{ severity: "error", code: "input.invalid", message }],
      }, null, 2)}\n`);
      return;
    }
    process.stdout.write(`NextClaw service app call failed\n\nErrors:\n- [input.invalid] ${message}\n`);
  };

  private format = (report: ServiceAppCallReport): string => {
    const heading = report.ok
      ? `NextClaw service app call passed: ${report.actionId ?? "(unknown)"}\n`
      : `NextClaw service app call failed: ${report.actionId ?? "(unknown)"}\n`;
    const appLines = report.app
      ? [
        `App: ${report.app.title} (${report.app.id})`,
        `Status: ${report.app.status}`,
        report.app.lastError ? `Last error: ${report.app.lastError}` : "",
      ].filter(Boolean).join("\n")
      : "";
    const result = report.result === undefined
      ? ""
      : `Result:\n${JSON.stringify(report.result, null, 2)}\n`;
    return [
      heading,
      appLines,
      result,
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
