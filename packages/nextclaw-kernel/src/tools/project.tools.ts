import { normalizeToolParams } from "@nextclaw/core";
import type { NcpTool } from "@nextclaw/ncp";
import type { ProjectManager } from "@kernel/managers/project.manager.js";
import type { ProjectTemplateId } from "@kernel/types/project.types.js";

function readRequiredString(value: unknown, key: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} must be a non-empty string.`);
  }
  return value.trim();
}
function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export class ProjectsListTool implements NcpTool {
  readonly name = "projects_list";
  readonly description = "List registered projects, including projects that do not have any sessions yet.";
  readonly parameters = {
    type: "object",
    properties: {},
    additionalProperties: false,
  };

  constructor(private readonly projects: ProjectManager) {}

  execute = async (): Promise<string> => {
    const projects = await this.projects.listProjects();
    return JSON.stringify({
      projects,
      templates: this.projects.listTemplates(),
      total: projects.length,
    }, null, 2);
  };
}

export class ProjectsCreateTool implements NcpTool {
  readonly name = "projects_create";
  readonly description = "Create and register an empty project or a project from a built-in template.";
  readonly parameters = {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Project name. Also used as the directory name when rootPath is omitted.",
      },
      rootPath: {
        type: "string",
        description: "Optional absolute or home-relative target directory.",
      },
      template: {
        type: "string",
        enum: ["empty", "knowledge-base"],
        description: "Built-in project template. Defaults to empty.",
      },
    },
    required: ["name"],
    additionalProperties: false,
  };

  constructor(private readonly projects: ProjectManager) {}

  execute = async (args: unknown): Promise<string> => {
    const params = normalizeToolParams(args);
    const name = readRequiredString(params.name, "name");
    const rootPath = readOptionalString(params.rootPath);
    const template = readOptionalString(params.template) as ProjectTemplateId | undefined;
    return JSON.stringify(await this.projects.createProject({
      name,
      ...(rootPath ? { rootPath } : {}),
      ...(template ? { template } : {}),
    }), null, 2);
  };
}
