import type { Context } from "hono";
import { isProjectError, type ProjectMaterialService } from "@nextclaw/kernel";
import { err, ok } from "@nextclaw-server/shared/utils/http-response.utils.js";

export class ProjectMaterialRoutesController {
  constructor(private readonly materials: ProjectMaterialService) {}

  readonly agreement = async (c: Context) =>
    await this.respond(c, () =>
      this.materials.getAgreement(c.req.param("projectId")),
    );

  readonly skills = async (c: Context) =>
    await this.respond(c, () =>
      this.materials.listSkills(c.req.param("projectId")),
    );

  private respond = async <T>(c: Context, action: () => Promise<T>) => {
    try {
      return c.json(ok(await action()));
    } catch (error) {
      if (isProjectError(error)) {
        return c.json(
          err(error.code, error.message),
          error.code === "PROJECT_NOT_FOUND" ? 404 : 400,
        );
      }
      throw error;
    }
  };
}
