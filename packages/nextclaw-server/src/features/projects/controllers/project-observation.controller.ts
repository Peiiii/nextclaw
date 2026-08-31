import type { Context } from "hono";
import {
  isProjectObservationError,
  type ProjectManager,
  type ProjectObservationService,
} from "@nextclaw/kernel";
import { err, ok } from "@nextclaw-server/shared/utils/http-response.utils.js";

export class ProjectObservationRoutesController {
  constructor(
    private readonly projectManager: Pick<ProjectManager, "getProjectById">,
    private readonly projectObservation: ProjectObservationService,
  ) {}

  readonly get = async (c: Context) => {
    const projectId = c.req.param("projectId")?.trim();
    if (!projectId) {
      return c.json(err("INVALID_PROJECT", "registered project id is required"), 400);
    }
    try {
      const project = await this.projectManager.getProjectById(projectId);
      if (!project) {
        return c.json(err("PROJECT_NOT_FOUND", "registered project was not found"), 404);
      }
      return c.json(ok(await this.projectObservation.observe(project.rootPath)));
    } catch (error) {
      if (isProjectObservationError(error)) {
        return c.json(
          err(error.code, error.message),
          error.code === "PROJECT_NOT_REGISTERED" ? 404 : 400,
        );
      }
      throw error;
    }
  };
}
