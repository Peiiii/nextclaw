import type { Context } from "hono";
import { isProjectError, type ProjectManager } from "@nextclaw/kernel";
import type {
  ProjectAddExistingRequest,
  ProjectCreateRequest,
  ProjectListView,
} from "@nextclaw-server/features/projects/types/projects-api.types.js";
import {
  err,
  isRecord,
  ok,
  readJson,
} from "@nextclaw-server/shared/utils/http-response.utils.js";

export class ProjectsRoutesController {
  constructor(private readonly projectManager: ProjectManager) {}

  readonly list = async (c: Context) => {
    const projects = await this.projectManager.listProjects();
    return c.json(ok({
      projects,
      templates: this.projectManager.listTemplates(),
      total: projects.length,
    } satisfies ProjectListView));
  };

  readonly create = async (c: Context) => {
    const body = await readJson<ProjectCreateRequest>(c.req.raw);
    if (!body.ok || !isRecord(body.data) || typeof body.data.name !== "string") {
      return c.json(err("INVALID_PROJECT", "project name is required"), 400);
    }
    try {
      return c.json(ok(await this.projectManager.createProject(body.data)), 201);
    } catch (error) {
      if (isProjectError(error)) {
        return c.json(err(error.code, error.message), 400);
      }
      throw error;
    }
  };

  readonly addExisting = async (c: Context) => {
    const body = await readJson<ProjectAddExistingRequest>(c.req.raw);
    if (!body.ok || !isRecord(body.data) || typeof body.data.rootPath !== "string") {
      return c.json(err("INVALID_PROJECT", "project directory is required"), 400);
    }
    try {
      const project = await this.projectManager.registerExistingProject(body.data.rootPath);
      if (!project) {
        return c.json(err(
          "PROJECT_PATH_IS_DEFAULT_WORKSPACE",
          "the default workspace cannot be registered as a project",
        ), 400);
      }
      return c.json(ok(project), 201);
    } catch (error) {
      if (isProjectError(error)) {
        return c.json(err(error.code, error.message), 400);
      }
      throw error;
    }
  };
}
