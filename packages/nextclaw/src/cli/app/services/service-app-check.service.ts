import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { AppCheckIssue, JsonRecord } from "@nextclaw-cli/cli/app/types/app-check.types.js";
import {
  isNodeCommand,
  isRecord,
  KEBAB_ID_PATTERN,
  readJsonObject,
  readOptionalString,
  readRequiredString,
  readStringArray,
  resolveRelativeFile,
  SERVICE_MANIFEST_FILE,
  VALID_SERVICE_ACTION_RISKS,
  fileExists,
} from "@nextclaw-cli/cli/app/utils/app-check.utils.js";

const execFileAsync = promisify(execFile);

export class ServiceAppCheckService {
  check = async (appPath: string): Promise<AppCheckIssue[]> => {
    const issues: AppCheckIssue[] = [];
    const manifestResult = await readJsonObject(path.join(appPath, SERVICE_MANIFEST_FILE));
    this.pushIssue(issues, manifestResult.issue);
    if (!manifestResult.value) {
      return issues;
    }

    const protocol = readOptionalString(manifestResult.value, "protocol") ?? "mcp";
    const serviceId = this.checkManifestFields(appPath, manifestResult.value, protocol, issues);
    const command = readOptionalString(manifestResult.value, "command");
    const args = readStringArray(manifestResult.value.args, "service.args");
    this.pushIssue(issues, args.issue);
    this.checkActions(serviceId, manifestResult.value.actions, issues);
    if (protocol === "wasi-component") {
      await this.checkPortableComponent(appPath, manifestResult.value, issues);
    } else {
      await this.checkCommand(appPath, command, args.values, issues);
    }
    return issues;
  };

  private checkManifestFields = (
    appPath: string,
    manifest: JsonRecord,
    protocol: string,
    issues: AppCheckIssue[],
  ): string | undefined => {
    const id = readRequiredString(manifest, "id", "service");
    this.pushIssue(issues, id.issue);
    if (id.value && (!KEBAB_ID_PATTERN.test(id.value) || id.value !== path.basename(appPath))) {
      issues.push({
        severity: "error",
        code: "service.id.invalid",
        message: `service-app.json id must be kebab-case and equal directory name: ${path.basename(appPath)}.`,
      });
    }
    this.pushIssue(issues, readRequiredString(manifest, "title", "service").issue);
    if (protocol === "mcp") {
      this.pushIssue(issues, readRequiredString(manifest, "command", "service").issue);
    } else if (protocol !== "wasi-component") {
      issues.push({
        severity: "error",
        code: "service.protocol.invalid",
        message: "Service App protocol must be mcp or wasi-component.",
      });
    }
    return id.value;
  };

  private checkPortableComponent = async (
    appPath: string,
    manifest: JsonRecord,
    issues: AppCheckIssue[],
  ): Promise<void> => {
    if (!isRecord(manifest.component)) {
      issues.push({
        severity: "error",
        code: "service.component.missing",
        message: "wasi-component Service App must declare component.entry.",
      });
      return;
    }
    const entry = readRequiredString(manifest.component, "entry", "service.component");
    this.pushIssue(issues, entry.issue);
    if (!entry.value) return;
    const normalized = entry.value.replace(/\\/g, "/");
    if (path.isAbsolute(normalized) || normalized.split("/").includes("..") || !normalized.endsWith(".wasm")) {
      issues.push({
        severity: "error",
        code: "service.component.entryInvalid",
        message: "service.component.entry must be a package-relative .wasm path.",
      });
      return;
    }
    const componentPath = resolveRelativeFile(appPath, normalized);
    if (!componentPath || !(await fileExists(componentPath))) {
      issues.push({
        severity: "error",
        code: "service.component.notFound",
        message: `Portable Component does not exist: ${entry.value}.`,
      });
    }
  };

  private checkActions = (
    serviceId: string | undefined,
    value: unknown,
    issues: AppCheckIssue[],
  ): void => {
    if (!isRecord(value) || Object.keys(value).length === 0) {
      issues.push({
        severity: "error",
        code: "service.actions.invalid",
        message: "service-app.json actions must be a non-empty object.",
      });
      return;
    }
    for (const [name, action] of Object.entries(value)) {
      this.checkActionName(serviceId, name, issues);
      this.checkActionManifest(name, action, issues);
    }
  };

  private checkActionName = (
    serviceId: string | undefined,
    name: string,
    issues: AppCheckIssue[],
  ): void => {
    if (!name.trim()) {
      issues.push({
        severity: "error",
        code: "service.action.nameEmpty",
        message: "Service App action name cannot be empty.",
      });
    }
    if (serviceId && name.startsWith(`${serviceId}.`)) {
      issues.push({
        severity: "error",
        code: "service.action.nameContainsServiceId",
        message: `Service App action key should not include the service id prefix: ${name}.`,
        fixHint: `Use "${name.slice(serviceId.length + 1)}" as the action key; Panel App actions use "${name}".`,
      });
    }
  };

  private checkActionManifest = (
    name: string,
    action: unknown,
    issues: AppCheckIssue[],
  ): void => {
    if (!isRecord(action)) {
      issues.push({
        severity: "error",
        code: "service.action.invalid",
        message: `Service App action ${name} must be an object.`,
      });
      return;
    }
    const risk = readOptionalString(action, "risk");
    if (!risk || !VALID_SERVICE_ACTION_RISKS.has(risk)) {
      issues.push({
        severity: "error",
        code: "service.action.riskInvalid",
        message: `Service App action ${name} must declare risk: read, write, external, or dangerous.`,
      });
    }
    if (action.inputSchema !== undefined && !isRecord(action.inputSchema)) {
      issues.push({
        severity: "error",
        code: "service.action.inputSchemaInvalid",
        message: `Service App action ${name} inputSchema must be an object.`,
      });
    }
  };

  private checkCommand = async (
    appPath: string,
    command: string | undefined,
    args: string[],
    issues: AppCheckIssue[],
  ): Promise<void> => {
    if (!command || !isNodeCommand(command)) {
      return;
    }
    const script = args.find((arg) => !arg.startsWith("-"));
    if (!script) {
      issues.push({
        severity: "error",
        code: "service.command.scriptMissing",
        message: "Node Service App command must point to a script file in args.",
        fixHint: "Use args like [\"server.mjs\"].",
      });
      return;
    }
    const scriptPath = resolveRelativeFile(appPath, script);
    if (!scriptPath || !(await fileExists(scriptPath))) {
      issues.push({
        severity: "error",
        code: "service.command.scriptNotFound",
        message: `Service App script does not exist: ${script}.`,
      });
      return;
    }
    await this.checkNodeSyntax(scriptPath, issues);
  };

  private checkNodeSyntax = async (scriptPath: string, issues: AppCheckIssue[]): Promise<void> => {
    if (!/\.(?:cjs|js|mjs)$/i.test(scriptPath)) {
      return;
    }
    try {
      await execFileAsync(process.execPath, ["--check", scriptPath], { timeout: 5000 });
    } catch (error) {
      issues.push({
        severity: "error",
        code: "service.command.syntaxInvalid",
        message: `Service App script has a JavaScript syntax error: ${path.basename(scriptPath)}.`,
        fixHint: this.readExecError(error),
      });
    }
  };

  private readExecError = (error: unknown): string => {
    const stderr = isRecord(error) && typeof error.stderr === "string"
      ? error.stderr.trim()
      : "";
    if (stderr) {
      return stderr;
    }
    return error instanceof Error ? error.message : String(error);
  };

  private pushIssue = (issues: AppCheckIssue[], issue: AppCheckIssue | undefined): void => {
    if (issue) {
      issues.push(issue);
    }
  };
}
