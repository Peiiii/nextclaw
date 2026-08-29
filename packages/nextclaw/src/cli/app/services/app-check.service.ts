import path from "node:path";
import {
  AppManifestService,
  isAppComponentManifestBundle,
} from "@nextclaw/app-runtime";
import { PanelAppCheckService } from "./panel-app-check.service.js";
import { ServiceAppCheckService } from "./service-app-check.service.js";
import type { ServiceAppDevService } from "./service-app-dev.service.js";
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
    private readonly serviceAppDevService?: ServiceAppDevService,
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
    const hasPackageManifest = await fileExists(path.join(appPath, "manifest.json"));
    if (hasPackageManifest && !hasPanelManifest && !hasServiceManifest) {
      return await this.checkPackage(appPath, issues);
    }
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

  private checkPackage = async (
    appPath: string,
    issues: AppCheckIssue[],
  ): Promise<AppCheckReport> => {
    try {
      const bundle = await new AppManifestService().load(appPath);
      if (!isAppComponentManifestBundle(bundle)) {
        issues.push({
          severity: "error",
          code: "app.package.schemaUnsupported",
          message: "app check package mode requires schemaVersion 2.",
          fixHint: "Use napp inspect for a schema v1 App, or migrate it to schema v2 components.",
        });
        return this.buildReport(appPath, "package", issues);
      }
      for (const component of bundle.components) {
        const componentIssues = await (component.kind === "panel"
          ? this.panelAppCheckService.check(component.componentDirectory)
          : this.serviceAppCheckService.check(component.componentDirectory));
        issues.push(...componentIssues);
        if (
          component.kind === "service" &&
          this.serviceAppDevService &&
          !componentIssues.some((issue) => issue.severity === "error")
        ) {
          const runtimeReport = await this.serviceAppDevService.inspect(appPath, {
            componentId: component.id,
            transientData: true,
          });
          issues.push(...runtimeReport.issues.map((issue) => ({
            severity: issue.severity,
            code: issue.code,
            message: issue.message,
            ...(issue.fixHint ? { fixHint: issue.fixHint } : {}),
          })));
        }
      }
      return this.buildReport(appPath, "package", issues);
    } catch (error) {
      issues.push({
        severity: "error",
        code: "app.package.invalid",
        message: error instanceof Error ? error.message : String(error),
      });
      return this.buildReport(appPath, "package", issues);
    }
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
