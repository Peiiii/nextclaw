import path from "node:path";
import { PanelAppCheckService } from "./panel-app-check.service.js";
import { ServiceAppCheckService } from "./service-app-check.service.js";
import type { AppCheckIssue, AppCheckKind, AppCheckReport } from "@nextclaw-cli/cli/app/types/app-check.types.js";
import {
  fileExists,
  getTargetDirectoryIssue,
  PANEL_MANIFEST_FILE,
  SERVICE_MANIFEST_FILE,
} from "@nextclaw-cli/cli/app/utils/app-check.utils.js";

export class AppCheckService {
  constructor(
    private readonly panelAppCheckService = new PanelAppCheckService(),
    private readonly serviceAppCheckService = new ServiceAppCheckService(),
  ) {}

  check = async (target: string): Promise<AppCheckReport> => {
    const appPath = path.resolve(target);
    const issues: AppCheckIssue[] = [];
    const directoryIssue = await getTargetDirectoryIssue(appPath);
    this.pushIssue(issues, directoryIssue);
    if (directoryIssue) {
      return this.buildReport(appPath, "unknown", issues);
    }

    const hasPanelManifest = await fileExists(path.join(appPath, PANEL_MANIFEST_FILE));
    const hasServiceManifest = await fileExists(path.join(appPath, SERVICE_MANIFEST_FILE));
    if (hasPanelManifest && hasServiceManifest) {
      issues.push({
        severity: "error",
        code: "app.manifest.mixed",
        message: "App directory contains both panel-app.json and service-app.json.",
        fixHint: "Keep Panel App and Service App in separate directories.",
      });
      return this.buildReport(appPath, "mixed", issues);
    }
    if (hasPanelManifest) {
      issues.push(...await this.panelAppCheckService.check(appPath));
      return this.buildReport(appPath, "panel", issues);
    }
    if (hasServiceManifest) {
      issues.push(...await this.serviceAppCheckService.check(appPath));
      return this.buildReport(appPath, "service", issues);
    }

    issues.push({
      severity: "error",
      code: "app.manifest.missing",
      message: "App directory must contain panel-app.json or service-app.json.",
      fixHint: "Run this command on a Panel App directory or a Service App directory.",
    });
    return this.buildReport(appPath, "unknown", issues);
  };

  private buildReport = (
    target: string,
    kind: AppCheckKind,
    issues: AppCheckIssue[],
  ): AppCheckReport => ({
    ok: !issues.some((issue) => issue.severity === "error"),
    kind,
    target,
    issues,
  });

  private pushIssue = (issues: AppCheckIssue[], issue: AppCheckIssue | undefined): void => {
    if (issue) {
      issues.push(issue);
    }
  };
}
