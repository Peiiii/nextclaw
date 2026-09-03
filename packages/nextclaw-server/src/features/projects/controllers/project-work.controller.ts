import type { Context } from "hono";
import {
  isProjectWorkError,
  ProjectWorkError,
  type CreateProjectWorkItemInput,
  type CreateProjectWorkStateInput,
  type ProjectWorkManager,
  type UpdateProjectWorkItemInput,
  type UpdateProjectWorkStateInput,
} from "@nextclaw/kernel";
import {
  err,
  isRecord,
  ok,
  readJson,
} from "@nextclaw-server/shared/utils/http-response.utils.js";

export class ProjectWorkRoutesController {
  constructor(private readonly projectWork: ProjectWorkManager) {}

  readonly list = async (c: Context) =>
    this.respond(
      c,
      async () =>
        await this.projectWork.list(c.req.param("projectId"), {
          includeDeleted: c.req.query("includeDeleted") === "true",
          ...(c.req.query("stateId")
            ? { stateId: c.req.query("stateId") }
            : {}),
          ...(c.req.query("cursor") ? { cursor: c.req.query("cursor") } : {}),
          ...(readLimit(c.req.query("limit")) !== undefined
            ? { limit: readLimit(c.req.query("limit")) }
            : {}),
        }),
    );

  readonly artifacts = async (c: Context) =>
    this.respond(
      c,
      async () =>
        await this.projectWork.listRecentArtifacts(c.req.param("projectId"), {
          ...(c.req.query("cursor") ? { cursor: c.req.query("cursor") } : {}),
          ...(readLimit(c.req.query("limit")) !== undefined
            ? { limit: readLimit(c.req.query("limit")) }
            : {}),
          ...(c.req.query("query") ? { query: c.req.query("query") } : {}),
        }),
    );

  readonly summary = async (c: Context) =>
    this.respond(
      c,
      async () => await this.projectWork.summary(c.req.param("projectId")),
    );

  readonly get = async (c: Context) =>
    this.respond(
      c,
      async () =>
        await this.projectWork.get(
          c.req.param("projectId"),
          c.req.param("workItemId"),
        ),
    );

  readonly create = async (c: Context) => {
    const body = await readJson<CreateProjectWorkItemInput>(c.req.raw);
    if (
      !body.ok ||
      !isRecord(body.data) ||
      typeof body.data.title !== "string"
    ) {
      return c.json(
        err("PROJECT_WORK_VALIDATION_FAILED", "work item title is required"),
        400,
      );
    }
    return await this.respond(
      c,
      async () =>
        await this.projectWork.create(
          c.req.param("projectId"),
          body.data,
          actorFor(c),
        ),
      201,
    );
  };

  readonly update = async (c: Context) => {
    const body = await readJson<UpdateProjectWorkItemInput>(c.req.raw);
    if (!body.ok || !isRecord(body.data)) {
      return c.json(
        err("PROJECT_WORK_VALIDATION_FAILED", "work item update is required"),
        400,
      );
    }
    return await this.respond(
      c,
      async () =>
        await this.projectWork.update(
          c.req.param("projectId"),
          c.req.param("workItemId"),
          body.data,
          actorFor(c),
        ),
    );
  };

  readonly delete = async (c: Context) =>
    this.respond(
      c,
      async () =>
        await this.projectWork.delete(
          c.req.param("projectId"),
          c.req.param("workItemId"),
          actorFor(c),
        ),
    );

  readonly restore = async (c: Context) =>
    this.respond(
      c,
      async () =>
        await this.projectWork.restore(
          c.req.param("projectId"),
          c.req.param("workItemId"),
          actorFor(c),
        ),
    );

  readonly activities = async (c: Context) =>
    this.respond(
      c,
      async () =>
        await this.projectWork.listActivities(
          c.req.param("projectId"),
          c.req.param("workItemId"),
          {
            ...(c.req.query("cursor") ? { cursor: c.req.query("cursor") } : {}),
            ...(readLimit(c.req.query("limit"))
              ? { limit: readLimit(c.req.query("limit")) }
              : {}),
          },
        ),
    );

  readonly linkArtifact = async (c: Context) => {
    const body = await readJson<{ path: string; label?: string }>(c.req.raw);
    if (
      !body.ok ||
      !isRecord(body.data) ||
      typeof body.data.path !== "string"
    ) {
      return c.json(
        err("PROJECT_WORK_ARTIFACT_INVALID", "artifact path is required"),
        400,
      );
    }
    return await this.respond(
      c,
      async () =>
        await this.projectWork.linkArtifact({
          projectId: c.req.param("projectId"),
          workItemId: c.req.param("workItemId"),
          path: body.data.path,
          ...(typeof body.data.label === "string"
            ? { label: body.data.label }
            : {}),
          actor: actorFor(c),
        }),
      201,
    );
  };

  readonly unlinkArtifact = async (c: Context) =>
    this.respond(c, async () => {
      await this.projectWork.unlinkArtifact({
        projectId: c.req.param("projectId"),
        workItemId: c.req.param("workItemId"),
        artifactLinkId: c.req.param("artifactLinkId"),
        actor: actorFor(c),
      });
      return { removed: true };
    });

  readonly listStates = async (c: Context) =>
    this.respond(
      c,
      async () => await this.projectWork.listStates(c.req.param("projectId")),
    );

  readonly createState = async (c: Context) => {
    const body = await readJson<CreateProjectWorkStateInput>(c.req.raw);
    if (
      !body.ok ||
      !isRecord(body.data) ||
      typeof body.data.name !== "string" ||
      typeof body.data.category !== "string"
    ) {
      return c.json(
        err(
          "PROJECT_WORK_VALIDATION_FAILED",
          "state name and category are required",
        ),
        400,
      );
    }
    return await this.respond(
      c,
      async () =>
        await this.projectWork.createState(c.req.param("projectId"), body.data),
      201,
    );
  };

  readonly updateState = async (c: Context) => {
    const body = await readJson<UpdateProjectWorkStateInput>(c.req.raw);
    if (!body.ok || !isRecord(body.data)) {
      return c.json(
        err("PROJECT_WORK_VALIDATION_FAILED", "state update is required"),
        400,
      );
    }
    return await this.respond(
      c,
      async () =>
        await this.projectWork.updateState(
          c.req.param("projectId"),
          c.req.param("stateId"),
          body.data,
        ),
    );
  };

  readonly deleteState = async (c: Context) => {
    const body = await readJson<{ migrateToStateId?: string | null }>(
      c.req.raw,
    );
    if (!body.ok || !isRecord(body.data)) {
      return c.json(
        err(
          "PROJECT_WORK_VALIDATION_FAILED",
          "state migration input is required",
        ),
        400,
      );
    }
    return await this.respond(c, async () => {
      await this.projectWork.deleteState(
        c.req.param("projectId"),
        c.req.param("stateId"),
        typeof body.data.migrateToStateId === "string"
          ? body.data.migrateToStateId
          : null,
        actorFor(c),
      );
      return { removed: true };
    });
  };

  private respond = async <T>(
    c: Context,
    action: () => Promise<T>,
    successStatus = 200,
  ) => {
    try {
      return c.json(ok(await action()), successStatus as 200 | 201);
    } catch (error) {
      if (!isProjectWorkError(error)) throw error;
      const status =
        error.code === "PROJECT_NOT_FOUND" || error.code.endsWith("NOT_FOUND")
          ? 404
          : error.code === "PROJECT_WORK_VERSION_CONFLICT" ||
              error.code === "PROJECT_WORK_STATE_IN_USE"
            ? 409
            : 400;
      return c.json(err(error.code, error.message), status);
    }
  };
}

function readLimit(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new ProjectWorkError(
      "PROJECT_WORK_VALIDATION_FAILED",
      "page limit must be an integer",
    );
  }
  return parsed;
}

function actorFor(c: Context) {
  return c.req.header("x-nextclaw-request-source") === "cli"
    ? { kind: "cli" as const, id: "nextclaw" }
    : { kind: "user" as const, id: "ui" };
}
