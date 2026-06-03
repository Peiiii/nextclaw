import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AppCheckIssue, JsonRecord } from "@nextclaw-cli/cli/app/types/app-check.types.js";
import {
  extractHtmlAssetPaths,
  extractScriptSrcs,
  fileExists,
  getMissingRelativeFileIssue,
  getRecommendedStringIssue,
  inferWorkspaceRoot,
  isRecord,
  isRelativeResource,
  KEBAB_ID_PATTERN,
  PANEL_MANIFEST_FILE,
  readJsonObject,
  readOptionalString,
  readRequiredString,
  readStringArray,
  resolveRelativeFile,
  SERVICE_ACTION_ID_PATTERN,
  SERVICE_MANIFEST_FILE,
  VALID_AGENT_CAPABILITIES,
} from "@nextclaw-cli/cli/app/utils/app-check.utils.js";

export class PanelAppCheckService {
  check = async (appPath: string): Promise<AppCheckIssue[]> => {
    const issues: AppCheckIssue[] = [];
    this.checkDirectoryName(appPath, issues);
    const manifestResult = await readJsonObject(path.join(appPath, PANEL_MANIFEST_FILE));
    this.pushIssue(issues, manifestResult.issue);
    if (!manifestResult.value) {
      return issues;
    }

    const entry = this.checkManifestFields(appPath, manifestResult.value, issues);
    this.checkCapabilities(manifestResult.value.capabilities, issues);
    const declaredActions = this.checkActions(manifestResult.value.actions, issues);
    await this.checkWorkspaceServiceActions(appPath, declaredActions, issues);
    await this.checkEntry(appPath, entry, manifestResult.value, declaredActions, issues);
    return issues;
  };

  private checkDirectoryName = (appPath: string, issues: AppCheckIssue[]): void => {
    if (!path.basename(appPath).endsWith(".panel")) {
      issues.push({
        severity: "error",
        code: "panel.directory.invalid",
        message: "Panel App directory name must end with .panel.",
        fixHint: "Rename the directory to <app-id>.panel.",
      });
    }
  };

  private checkManifestFields = (
    appPath: string,
    manifest: JsonRecord,
    issues: AppCheckIssue[],
  ): string | undefined => {
    const appId = path.basename(appPath).replace(/\.panel$/, "");
    const id = readOptionalString(manifest, "id");
    if (id && (!KEBAB_ID_PATTERN.test(id) || id !== appId)) {
      issues.push({
        severity: "error",
        code: "panel.id.invalid",
        message: `panel-app.json id must equal directory app id: ${appId}.`,
        fixHint: "Remove id or set it to the directory name without .panel.",
      });
    }
    const title = readRequiredString(manifest, "title", "panel");
    this.pushIssue(issues, title.issue);
    this.pushIssue(issues, getRecommendedStringIssue(manifest, "description", "panel"));
    this.pushIssue(issues, getRecommendedStringIssue(manifest, "icon", "panel"));
    const entry = readRequiredString(manifest, "entry", "panel");
    this.pushIssue(issues, entry.issue);
    return entry.value;
  };

  private checkCapabilities = (value: unknown, issues: AppCheckIssue[]): void => {
    const capabilities = readStringArray(value, "panel.capabilities");
    this.pushIssue(issues, capabilities.issue);
    for (const capability of capabilities.values) {
      if (VALID_AGENT_CAPABILITIES.has(capability)) {
        continue;
      }
      issues.push({
        severity: "error",
        code: "panel.capability.invalid",
        message: `Invalid agent capability: ${capability}.`,
        fixHint: capability.includes(".")
          ? "Use agent:send or agent:generateObject, with a colon."
          : "Allowed values are agent:send and agent:generateObject.",
      });
    }
  };

  private checkActions = (value: unknown, issues: AppCheckIssue[]): string[] => {
    const actions = readStringArray(value, "panel.actions");
    this.pushIssue(issues, actions.issue);
    for (const action of actions.values) {
      if (SERVICE_ACTION_ID_PATTERN.test(action)) {
        continue;
      }
      issues.push({
        severity: "error",
        code: "panel.action.invalid",
        message: `Invalid service action id: ${action}.`,
        fixHint: "Use <service-app-id>.<tool-name>, for example workspace-files.list.",
      });
    }
    return actions.values;
  };

  private checkWorkspaceServiceActions = async (
    appPath: string,
    actions: string[],
    issues: AppCheckIssue[],
  ): Promise<void> => {
    const workspaceRoot = inferWorkspaceRoot(appPath, "panels");
    if (!workspaceRoot || actions.length === 0) {
      return;
    }
    const cache = new Map<string, JsonRecord | null>();
    for (const action of actions) {
      const match = action.match(SERVICE_ACTION_ID_PATTERN);
      if (!match) {
        continue;
      }
      await this.checkWorkspaceServiceAction(
        workspaceRoot,
        match[1] ?? "",
        match[2] ?? "",
        cache,
        issues,
      );
    }
  };

  private checkWorkspaceServiceAction = async (
    workspaceRoot: string,
    serviceId: string,
    actionName: string,
    cache: Map<string, JsonRecord | null>,
    issues: AppCheckIssue[],
  ): Promise<void> => {
    const manifest = await this.readCachedServiceManifest(workspaceRoot, serviceId, cache, issues);
    if (!manifest) {
      return;
    }
    const actions = manifest.actions;
    if (!isRecord(actions) || !isRecord(actions[actionName])) {
      issues.push({
        severity: "error",
        code: "panel.action.missingServiceAction",
        message: `Declared service action does not exist: ${serviceId}.${actionName}.`,
        fixHint: `Add "${actionName}" to service-apps/${serviceId}/service-app.json actions or fix panel-app.json actions.`,
      });
    }
  };

  private checkEntry = async (
    appPath: string,
    entry: string | undefined,
    manifest: JsonRecord,
    declaredActions: string[],
    issues: AppCheckIssue[],
  ): Promise<void> => {
    if (!entry) {
      return;
    }
    const entryPath = resolveRelativeFile(appPath, entry);
    if (!entryPath) {
      issues.push({
        severity: "error",
        code: "panel.entry.invalid",
        message: `Panel entry must be a relative file inside the app directory: ${entry}.`,
      });
      return;
    }
    if (!(await fileExists(entryPath))) {
      issues.push({
        severity: "error",
        code: "panel.entry.missing",
        message: `Panel entry file does not exist: ${entry}.`,
      });
      return;
    }
    await this.checkEntryContent(appPath, entryPath, manifest, declaredActions, issues);
  };

  private checkEntryContent = async (
    appPath: string,
    entryPath: string,
    manifest: JsonRecord,
    declaredActions: string[],
    issues: AppCheckIssue[],
  ): Promise<void> => {
    const html = await readFile(entryPath, "utf8");
    this.checkLegacyMeta(html, issues);
    await this.checkIcon(appPath, manifest.icon, issues);
    await this.checkRelativeAssets(appPath, html, issues);
    const scripts = await this.readReferencedScripts(appPath, html, issues);
    this.checkBridgeUsage([html, ...scripts].join("\n"), manifest, declaredActions, issues);
  };

  private checkLegacyMeta = (html: string, issues: AppCheckIssue[]): void => {
    if (/name\s*=\s*["']nextclaw-panel-(actions|capabilities)["']/i.test(html)) {
      issues.push({
        severity: "error",
        code: "panel.meta.deprecated",
        message: "Directory Panel Apps must not declare NextClaw actions or capabilities in HTML meta tags.",
        fixHint: "Move actions and capabilities into panel-app.json.",
      });
    }
  };

  private checkIcon = async (
    appPath: string,
    icon: unknown,
    issues: AppCheckIssue[],
  ): Promise<void> => {
    if (typeof icon !== "string" || !this.isRelativeIconFile(icon)) {
      return;
    }
    this.pushIssue(
      issues,
      await getMissingRelativeFileIssue(appPath, icon, "panel.icon.missing", "Panel icon file does not exist"),
    );
  };

  private isRelativeIconFile = (icon: string): boolean =>
    isRelativeResource(icon) && (icon.includes("/") || /\.(?:svg|png|jpe?g|gif|webp|ico)$/i.test(icon));

  private checkRelativeAssets = async (
    appPath: string,
    html: string,
    issues: AppCheckIssue[],
  ): Promise<void> => {
    for (const asset of extractHtmlAssetPaths(html)) {
      this.pushIssue(
        issues,
        await getMissingRelativeFileIssue(appPath, asset, "panel.asset.missing", "Panel asset file does not exist"),
      );
    }
  };

  private readReferencedScripts = async (
    appPath: string,
    html: string,
    issues: AppCheckIssue[],
  ): Promise<string[]> => {
    const scripts: string[] = [];
    for (const src of extractScriptSrcs(html)) {
      if (!isRelativeResource(src)) {
        continue;
      }
      const scriptPath = resolveRelativeFile(appPath, src);
      if (scriptPath && await fileExists(scriptPath)) {
        scripts.push(await readFile(scriptPath, "utf8"));
      } else {
        issues.push({
          severity: "error",
          code: "panel.script.missing",
          message: `Panel script file does not exist: ${src}.`,
        });
      }
    }
    return scripts;
  };

  private checkBridgeUsage = (
    code: string,
    manifest: JsonRecord,
    declaredActions: string[],
    issues: AppCheckIssue[],
  ): void => {
    const capabilities = readStringArray(manifest.capabilities, "panel.capabilities");
    this.checkRequiredCapability(code, "generateObject", "agent:generateObject", capabilities.values, issues);
    this.checkRequiredCapability(code, "send", "agent:send", capabilities.values, issues);
    this.checkServiceActionInvocations(code, declaredActions, issues);
  };

  private checkRequiredCapability = (
    code: string,
    method: string,
    capability: string,
    declared: string[],
    issues: AppCheckIssue[],
  ): void => {
    if (new RegExp(`nextclaw\\s*\\.\\s*agent\\s*\\.\\s*${method}\\b`).test(code) && !declared.includes(capability)) {
      issues.push({
        severity: "error",
        code: "panel.capability.missing",
        message: `Panel code calls window.nextclaw.agent.${method} but panel-app.json does not declare ${capability}.`,
        fixHint: `Add "${capability}" to panel-app.json capabilities.`,
      });
    }
  };

  private checkServiceActionInvocations = (
    code: string,
    declaredActions: string[],
    issues: AppCheckIssue[],
  ): void => {
    const literalActions = [...code.matchAll(/serviceActions\s*\.\s*invoke\s*\(\s*["']([^"']+)["']/g)]
      .map((match) => match[1] ?? "");
    if (literalActions.length === 0 && /serviceActions\s*\.\s*invoke\s*\(/.test(code)) {
      issues.push({
        severity: "warning",
        code: "panel.action.dynamicInvoke",
        message: "Panel code calls serviceActions.invoke with a dynamic action id.",
        fixHint: "Make sure every possible action id is declared in panel-app.json actions.",
      });
    }
    for (const action of literalActions) {
      if (!declaredActions.includes(action)) {
        issues.push({
          severity: "error",
          code: "panel.action.missingDeclaration",
          message: `Panel code invokes ${action} but panel-app.json actions does not declare it.`,
          fixHint: `Add "${action}" to panel-app.json actions or update the invoke call.`,
        });
      }
    }
  };

  private readCachedServiceManifest = async (
    workspaceRoot: string,
    serviceId: string,
    cache: Map<string, JsonRecord | null>,
    issues: AppCheckIssue[],
  ): Promise<JsonRecord | null> => {
    if (cache.has(serviceId)) {
      return cache.get(serviceId) ?? null;
    }
    const manifestPath = path.join(workspaceRoot, "service-apps", serviceId, SERVICE_MANIFEST_FILE);
    if (!(await fileExists(manifestPath))) {
      issues.push({
        severity: "error",
        code: "panel.action.serviceMissing",
        message: `Declared service app does not exist: ${serviceId}.`,
        fixHint: `Create service-apps/${serviceId}/service-app.json or remove actions for ${serviceId}.`,
      });
      cache.set(serviceId, null);
      return null;
    }
    const manifestResult = await readJsonObject(manifestPath);
    if (!manifestResult.value) {
      if (manifestResult.issue) {
        issues.push({
          ...manifestResult.issue,
          code: `panel.action.${manifestResult.issue.code}`,
        });
      }
      cache.set(serviceId, null);
      return null;
    }
    cache.set(serviceId, manifestResult.value);
    return manifestResult.value;
  };

  private pushIssue = (issues: AppCheckIssue[], issue: AppCheckIssue | undefined): void => {
    if (issue) {
      issues.push(issue);
    }
  };
}
