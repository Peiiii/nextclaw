import { readFile } from "node:fs/promises";
import path from "node:path";
import { AppManifestService, isAppComponentManifestBundle } from "@nextclaw/app-runtime";
import { AppCheckService } from "@nextclaw-cli/cli/app/services/app-check.service.js";
import { ServiceAppDevService } from "@nextclaw-cli/cli/app/services/service-app-dev.service.js";

type SmokeFixture = {
  schemaVersion: 1;
  component: string;
  resetData?: boolean;
  steps: Array<{
    action: string;
    input?: Record<string, unknown>;
    expect?: Record<string, unknown>;
  }>;
};

export type AppTestReport = {
  ok: boolean;
  target: string;
  component?: string;
  steps: Array<{ action: string; ok: boolean; result?: unknown; message?: string }>;
  issues: Array<{ code: string; message: string }>;
};

export class AppTestService {
  constructor(
    private readonly appCheckService = new AppCheckService(),
    private readonly serviceAppDevService = new ServiceAppDevService(),
  ) {}

  test = async (target: string): Promise<AppTestReport> => {
    const appPath = path.resolve(target);
    const check = await this.appCheckService.check(appPath);
    if (!check.ok) {
      return {
        ok: false,
        target: appPath,
        steps: [],
        issues: check.issues.filter((issue) => issue.severity === "error")
          .map(({ code, message }) => ({ code, message })),
      };
    }
    const bundle = await new AppManifestService().load(appPath);
    if (!isAppComponentManifestBundle(bundle)) {
      return {
        ok: false,
        target: appPath,
        steps: [],
        issues: [{ code: "app.test.schemaUnsupported", message: "app test requires a schema v2 package." }],
      };
    }
    const fixture = await this.loadFixture(appPath);
    const service = bundle.components.find(
      (component) => component.kind === "service" && component.id === fixture.component,
    );
    if (!service) {
      return {
        ok: false,
        target: appPath,
        component: fixture.component,
        steps: [],
        issues: [{
          code: "app.test.componentMissing",
          message: `Smoke fixture references an unknown Service Component: ${fixture.component}.`,
        }],
      };
    }
    if (fixture.resetData) {
      const reset = await this.serviceAppDevService.inspect(appPath, {
        componentId: fixture.component,
        resetData: true,
        confirmAppId: fixture.component,
      });
      if (!reset.ok) {
        return {
          ok: false,
          target: appPath,
          component: fixture.component,
          steps: [],
          issues: reset.issues.map(({ code, message }) => ({ code, message })),
        };
      }
    }
    const steps: AppTestReport["steps"] = [];
    for (const step of fixture.steps) {
      const report = await this.serviceAppDevService.call(
        appPath,
        step.action,
        step.input ?? {},
        { componentId: fixture.component },
      );
      const matches = report.ok && this.matchesSubset(report.result, step.expect ?? {});
      steps.push({
        action: step.action,
        ok: matches,
        ...(report.result !== undefined ? { result: report.result } : {}),
        ...(!matches ? {
          message: report.ok
            ? `Result does not match expected subset: ${JSON.stringify(step.expect ?? {})}`
            : report.issues.map((issue) => `[${issue.code}] ${issue.message}`).join("; "),
        } : {}),
      });
      if (!matches) break;
    }
    return {
      ok: steps.length === fixture.steps.length && steps.every((step) => step.ok),
      target: appPath,
      component: fixture.component,
      steps,
      issues: [],
    };
  };

  private loadFixture = async (appPath: string): Promise<SmokeFixture> => {
    const fixturePath = path.join(appPath, "tests", "service-smoke.json");
    const parsed = JSON.parse(await readFile(fixturePath, "utf8")) as Partial<SmokeFixture>;
    if (parsed.schemaVersion !== 1 || !parsed.component?.trim() || !Array.isArray(parsed.steps)) {
      throw new Error(`Invalid App smoke fixture: ${fixturePath}.`);
    }
    return parsed as SmokeFixture;
  };

  private matchesSubset = (actual: unknown, expected: Record<string, unknown>): boolean => {
    if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;
    return Object.entries(expected).every(([key, value]) =>
      JSON.stringify((actual as Record<string, unknown>)[key]) === JSON.stringify(value));
  };
}
