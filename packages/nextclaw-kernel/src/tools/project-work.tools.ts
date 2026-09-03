import { normalizeToolParams } from "@nextclaw/core";
import type { NcpTool } from "@nextclaw/ncp";
import type {
  ProjectWorkAttention,
  ProjectWorkManager,
} from "@kernel/features/projects/index.js";

type ProjectWorkToolContext = {
  projectId: string;
  sessionId: string;
  agentId?: string;
};

function requiredString(value: unknown, key: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${key} must be a non-empty string.`);
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : undefined;
}

function agentActor(context: ProjectWorkToolContext) {
  return {
    kind: "agent" as const,
    ...(context.agentId ? { id: context.agentId } : {}),
    sessionId: context.sessionId,
  };
}

export class ProjectWorkListTool implements NcpTool {
  readonly name = "project_work_list";
  readonly description =
    "List one bounded page of persistent work items for the current project.";
  readonly parameters = {
    type: "object",
    properties: {
      include_deleted: {
        type: "boolean",
        description: "Include deleted work items.",
      },
      state_id: {
        type: "string",
        description: "Only return work items in this custom state.",
      },
      cursor: {
        type: "string",
        description: "Opaque next_cursor from an earlier list response.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 100,
        description: "Page size. Defaults to 20.",
      },
    },
    additionalProperties: false,
  };

  constructor(
    private readonly work: ProjectWorkManager,
    private readonly context: ProjectWorkToolContext,
  ) {}

  execute = async (args: unknown): Promise<string> => {
    const params = normalizeToolParams(args);
    return JSON.stringify(
      await this.work.list(this.context.projectId, {
        includeDeleted: optionalBoolean(params.include_deleted) ?? false,
        ...(optionalString(params.state_id)
          ? { stateId: optionalString(params.state_id) }
          : {}),
        ...(optionalString(params.cursor)
          ? { cursor: optionalString(params.cursor) }
          : {}),
        ...(optionalNumber(params.limit)
          ? { limit: optionalNumber(params.limit) }
          : {}),
      }),
      null,
      2,
    );
  };
}

export class ProjectWorkGetTool implements NcpTool {
  readonly name = "project_work_get";
  readonly description =
    "Get one current-project work item with artifact links and recent immutable activity.";
  readonly parameters = {
    type: "object",
    properties: {
      id: { type: "string", description: "Work item id." },
      activity_limit: {
        type: "integer",
        minimum: 1,
        maximum: 100,
        description: "Recent activity entries. Defaults to 20.",
      },
    },
    required: ["id"],
    additionalProperties: false,
  };

  constructor(
    private readonly work: ProjectWorkManager,
    private readonly context: ProjectWorkToolContext,
  ) {}

  execute = async (args: unknown): Promise<string> => {
    const params = normalizeToolParams(args);
    const id = requiredString(params.id, "id");
    const [item, activity] = await Promise.all([
      this.work.get(this.context.projectId, id),
      this.work.listActivities(this.context.projectId, id, {
        limit: optionalNumber(params.activity_limit) ?? 20,
      }),
    ]);
    return JSON.stringify({ item, activity }, null, 2);
  };
}

export class ProjectWorkCreateTool implements NcpTool {
  readonly name = "project_work_create";
  readonly description =
    "Create a persistent work item in the current project.";
  readonly parameters = {
    type: "object",
    properties: {
      title: { type: "string", description: "Concise work item title." },
      description: {
        type: "string",
        description: "Optional durable context and acceptance notes.",
      },
      state_id: {
        type: "string",
        description:
          "Optional custom state id. The project default is used when omitted.",
      },
      attention: { type: "string", enum: ["none", "blocked", "awaiting-user"] },
    },
    required: ["title"],
    additionalProperties: false,
  };

  constructor(
    private readonly work: ProjectWorkManager,
    private readonly context: ProjectWorkToolContext,
  ) {}

  execute = async (args: unknown): Promise<string> => {
    const params = normalizeToolParams(args);
    return JSON.stringify(
      await this.work.create(
        this.context.projectId,
        {
          title: requiredString(params.title, "title"),
          ...(optionalString(params.description)
            ? { description: optionalString(params.description) }
            : {}),
          ...(optionalString(params.state_id)
            ? { stateId: optionalString(params.state_id) }
            : {}),
          ...(optionalString(params.attention)
            ? {
                attention: optionalString(
                  params.attention,
                ) as ProjectWorkAttention,
              }
            : {}),
        },
        agentActor(this.context),
      ),
      null,
      2,
    );
  };
}

export class ProjectWorkUpdateTool implements NcpTool {
  readonly name = "project_work_update";
  readonly description =
    "Update, soft-delete, or restore a current-project work item, or add/remove its artifact links. Status changes use state_id; there is no separate start tool.";
  readonly parameters = {
    type: "object",
    properties: {
      id: { type: "string", description: "Work item id." },
      title: { type: "string" },
      description: { type: "string" },
      state_id: { type: "string" },
      attention: { type: "string", enum: ["none", "blocked", "awaiting-user"] },
      expected_version: { type: "integer", minimum: 1 },
      deleted: {
        type: "boolean",
        description: "True to soft-delete the item; false to restore it.",
      },
      add_artifact: {
        type: "object",
        properties: { path: { type: "string" }, label: { type: "string" } },
        required: ["path"],
        additionalProperties: false,
      },
      remove_artifact_id: { type: "string" },
    },
    required: ["id"],
    additionalProperties: false,
  };

  constructor(
    private readonly work: ProjectWorkManager,
    private readonly context: ProjectWorkToolContext,
  ) {}

  execute = async (args: unknown): Promise<string> => {
    const params = normalizeToolParams(args);
    const id = requiredString(params.id, "id");
    const actor = agentActor(this.context);
    const patch = {
      ...(params.title !== undefined
        ? { title: requiredString(params.title, "title") }
        : {}),
      ...(typeof params.description === "string"
        ? { description: params.description }
        : {}),
      ...(optionalString(params.state_id)
        ? { stateId: optionalString(params.state_id) }
        : {}),
      ...(optionalString(params.attention)
        ? {
            attention: optionalString(params.attention) as ProjectWorkAttention,
          }
        : {}),
      ...(optionalNumber(params.expected_version)
        ? { expectedVersion: optionalNumber(params.expected_version) }
        : {}),
    };
    if (Object.keys(patch).length > 0) {
      await this.work.update(this.context.projectId, id, patch, actor);
    }
    const deleted = optionalBoolean(params.deleted);
    if (deleted !== undefined) {
      await (deleted
        ? this.work.delete(this.context.projectId, id, actor)
        : this.work.restore(this.context.projectId, id, actor));
    }
    if (
      params.add_artifact &&
      typeof params.add_artifact === "object" &&
      !Array.isArray(params.add_artifact)
    ) {
      const artifact = params.add_artifact as Record<string, unknown>;
      await this.work.linkArtifact({
        projectId: this.context.projectId,
        workItemId: id,
        path: requiredString(artifact.path, "add_artifact.path"),
        ...(optionalString(artifact.label)
          ? { label: optionalString(artifact.label) }
          : {}),
        actor,
      });
    }
    const removeArtifactId = optionalString(params.remove_artifact_id);
    if (removeArtifactId) {
      await this.work.unlinkArtifact({
        projectId: this.context.projectId,
        workItemId: id,
        artifactLinkId: removeArtifactId,
        actor,
      });
    }
    return JSON.stringify(
      await this.work.get(this.context.projectId, id),
      null,
      2,
    );
  };
}
