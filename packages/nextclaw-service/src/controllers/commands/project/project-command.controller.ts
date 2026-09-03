import type {
  CreateProjectInput,
  NextclawKernel,
  ProjectRecord,
  ProjectWorkActivityPage,
  ProjectWorkItemDetail,
  ProjectWorkItemPage,
  ProjectWorkState,
} from "@nextclaw/kernel";
import {
  resolveLocalUiApiBase,
  UiBridgeApiClient,
} from "@nextclaw-service/services/ui/ui-bridge-api.service.js";

export type ProjectCommandOptions = {
  json?: boolean;
};

export type ProjectCreateCommandOptions = ProjectCommandOptions & {
  path?: string;
  template?: "empty" | "knowledge-base";
};

export type ProjectRemoveCommandOptions = ProjectCommandOptions & {
  confirm: string;
};

export type ProjectWorkCommandOptions = ProjectCommandOptions & {
  project: string;
};

export type ProjectWorkListCommandOptions = ProjectWorkCommandOptions & {
  includeDeleted?: boolean;
  state?: string;
  cursor?: string;
  limit?: string;
};

export type ProjectWorkCreateCommandOptions = ProjectWorkCommandOptions & {
  description?: string;
  state?: string;
  attention?: "none" | "blocked" | "awaiting-user";
};

export type ProjectWorkUpdateCommandOptions = ProjectWorkCommandOptions & {
  title?: string;
  description?: string;
  state?: string;
  attention?: "none" | "blocked" | "awaiting-user";
  version?: string;
};

export class ProjectCommands {
  constructor(
    private readonly createKernel: () => NextclawKernel,
    private readonly createApiClient: () => UiBridgeApiClient = () => {
      const apiBase = resolveLocalUiApiBase();
      if (!apiBase)
        throw new Error(
          "NextClaw local service is not running. Project work commands require the running service.",
        );
      return new UiBridgeApiClient(apiBase);
    },
  ) {}

  list = async (options: ProjectCommandOptions = {}): Promise<void> => {
    await this.withKernel(async (kernel) => {
      const projects = await kernel.projectManager.listProjects();
      if (options.json) {
        console.log(
          JSON.stringify({ projects, total: projects.length }, null, 2),
        );
        return;
      }
      if (projects.length === 0) {
        console.log("No projects registered.");
        return;
      }
      for (const project of projects) {
        console.log(
          `${project.name}\t${project.template ?? "existing"}\t${project.rootPath}`,
        );
      }
    });
  };

  templates = async (options: ProjectCommandOptions = {}): Promise<void> => {
    await this.withKernel(async (kernel) => {
      const templates = kernel.projectManager.listTemplates();
      if (options.json) {
        console.log(JSON.stringify({ templates }, null, 2));
        return;
      }
      for (const template of templates) {
        console.log(`${template.id}\t${template.description}`);
      }
    });
  };

  create = async (
    name: string,
    options: ProjectCreateCommandOptions = {},
  ): Promise<void> => {
    await this.withKernel(async (kernel) => {
      const input: CreateProjectInput = {
        name,
        ...(options.path ? { rootPath: options.path } : {}),
        ...(options.template ? { template: options.template } : {}),
      };
      const project = await kernel.projectManager.createProject(input);
      this.printCreatedProject(project, Boolean(options.json));
    });
  };

  remove = async (
    projectId: string,
    options: ProjectRemoveCommandOptions,
  ): Promise<void> => {
    if (options.confirm !== projectId) {
      throw new Error(
        `--confirm must exactly match the project id: ${projectId}`,
      );
    }
    await this.withKernel(async (kernel) => {
      const project = await kernel.projectManager.removeProject(
        projectId,
        options.confirm,
      );
      if (options.json) {
        this.printJson(project);
        return;
      }
      console.log(`Removed project "${project.name}" from the project list`);
    });
  };

  workList = async (options: ProjectWorkListCommandOptions): Promise<void> => {
    const {
      cursor,
      includeDeleted,
      json,
      limit: rawLimit,
      project,
      state,
    } = options;
    const limit = rawLimit === undefined ? 20 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new Error("--limit must be an integer from 1 to 100");
    const query = new URLSearchParams({ limit: String(limit) });
    if (includeDeleted) query.set("includeDeleted", "true");
    if (state) query.set("stateId", state);
    if (cursor) query.set("cursor", cursor);
    const work = await this.api<ProjectWorkItemPage>(
      `/api/projects/${encodeURIComponent(project)}/work?${query.toString()}`,
    );
    if (json) return this.printJson(work);
    if (!work.items.length) return void console.log("No work items.");
    for (const item of work.items)
      console.log(
        `${item.id}\t${item.state.name}\t${item.attention}\t${item.title}`,
      );
    if (work.nextCursor)
      console.log(`More work items available. Next cursor: ${work.nextCursor}`);
  };

  workGet = async (
    workItemId: string,
    options: ProjectWorkCommandOptions,
  ): Promise<void> => {
    const item = await this.api<ProjectWorkItemDetail>(
      this.workItemPath(options.project, workItemId),
    );
    if (options.json) return this.printJson(item);
    console.log(
      `${item.id}\t${item.state.name}\t${item.attention}\t${item.title}`,
    );
    if (item.description) console.log(item.description);
    for (const artifact of item.artifacts)
      console.log(`artifact\t${artifact.id}\t${artifact.path}`);
  };

  workCreate = async (
    title: string,
    options: ProjectWorkCreateCommandOptions,
  ): Promise<void> => {
    const { attention, description, json, project, state } = options;
    const item = await this.api<ProjectWorkItemDetail>(
      `/api/projects/${encodeURIComponent(project)}/work/items`,
      "POST",
      {
        title,
        ...(description ? { description } : {}),
        ...(state ? { stateId: state } : {}),
        ...(attention ? { attention } : {}),
      },
    );
    this.printWorkMutation("Created", item, Boolean(json));
  };

  workUpdate = async (
    workItemId: string,
    options: ProjectWorkUpdateCommandOptions,
  ): Promise<void> => {
    const { attention, description, json, project, state, title, version } =
      options;
    const expectedVersion = version === undefined ? undefined : Number(version);
    if (expectedVersion !== undefined && !Number.isInteger(expectedVersion))
      throw new Error("--version must be an integer");
    const item = await this.api<ProjectWorkItemDetail>(
      this.workItemPath(project, workItemId),
      "PATCH",
      {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(state ? { stateId: state } : {}),
        ...(attention ? { attention } : {}),
        ...(expectedVersion !== undefined ? { expectedVersion } : {}),
      },
    );
    this.printWorkMutation("Updated", item, Boolean(json));
  };

  workDelete = async (
    workItemId: string,
    options: ProjectWorkCommandOptions,
  ): Promise<void> => {
    const item = await this.api<ProjectWorkItemDetail>(
      this.workItemPath(options.project, workItemId),
      "DELETE",
    );
    this.printWorkMutation("Deleted", item, Boolean(options.json));
  };

  workRestore = async (
    workItemId: string,
    options: ProjectWorkCommandOptions,
  ): Promise<void> => {
    const item = await this.api<ProjectWorkItemDetail>(
      `${this.workItemPath(options.project, workItemId)}/restore`,
      "POST",
    );
    this.printWorkMutation("Restored", item, Boolean(options.json));
  };

  workActivity = async (
    workItemId: string,
    options: ProjectWorkCommandOptions & { limit?: string },
  ): Promise<void> => {
    const { json, limit: limitInput, project } = options;
    const limit = limitInput ? Number(limitInput) : 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new Error("--limit must be an integer from 1 to 100");
    const page = await this.api<ProjectWorkActivityPage>(
      `${this.workItemPath(project, workItemId)}/activities?limit=${limit}`,
    );
    if (json) return this.printJson(page);
    for (const activity of page.activities)
      console.log(
        `${activity.createdAt}\t${activity.type}\t${activity.actor.kind}`,
      );
  };

  workArtifactLink = async (
    workItemId: string,
    path: string,
    options: ProjectWorkCommandOptions & { label?: string },
  ): Promise<void> => {
    const { json, label, project } = options;
    const result = await this.api<unknown>(
      `${this.workItemPath(project, workItemId)}/artifacts`,
      "POST",
      {
        path,
        ...(label ? { label } : {}),
      },
    );
    if (json) this.printJson(result);
    else console.log(`Linked artifact ${path}`);
  };

  workArtifactUnlink = async (
    workItemId: string,
    artifactLinkId: string,
    options: ProjectWorkCommandOptions,
  ): Promise<void> => {
    const result = await this.api<unknown>(
      `${this.workItemPath(options.project, workItemId)}/artifacts/${encodeURIComponent(artifactLinkId)}`,
      "DELETE",
    );
    if (options.json) this.printJson(result);
    else console.log(`Unlinked artifact ${artifactLinkId}`);
  };

  workStateList = async (options: ProjectWorkCommandOptions): Promise<void> => {
    const states = await this.api<ProjectWorkState[]>(
      `/api/projects/${encodeURIComponent(options.project)}/work/states`,
    );
    if (options.json) return this.printJson(states);
    for (const state of states)
      console.log(
        `${state.id}\t${state.position}\t${state.category}\t${state.isDefault ? "default" : ""}\t${state.name}`,
      );
  };

  workStateCreate = async (
    name: string,
    options: ProjectWorkCommandOptions & {
      category: ProjectWorkState["category"];
      position?: string;
      default?: boolean;
    },
  ): Promise<void> => {
    const {
      category,
      default: isDefault,
      json,
      position: positionInput,
      project,
    } = options;
    const position =
      positionInput === undefined ? undefined : Number(positionInput);
    if (position !== undefined && !Number.isInteger(position))
      throw new Error("--position must be an integer");
    const state = await this.api<ProjectWorkState>(
      `/api/projects/${encodeURIComponent(project)}/work/states`,
      "POST",
      {
        name,
        category,
        ...(position !== undefined ? { position } : {}),
        ...(isDefault ? { isDefault: true } : {}),
      },
    );
    if (json) this.printJson(state);
    else console.log(`Created state ${state.id}\t${state.name}`);
  };

  workStateUpdate = async (
    stateId: string,
    options: ProjectWorkCommandOptions & {
      name?: string;
      category?: ProjectWorkState["category"];
      position?: string;
      default?: boolean;
    },
  ): Promise<void> => {
    const {
      category,
      default: isDefault,
      json,
      name,
      position: positionInput,
      project,
    } = options;
    const position =
      positionInput === undefined ? undefined : Number(positionInput);
    if (position !== undefined && !Number.isInteger(position))
      throw new Error("--position must be an integer");
    const state = await this.api<ProjectWorkState>(
      this.workStatePath(project, stateId),
      "PATCH",
      {
        ...(name !== undefined ? { name } : {}),
        ...(category ? { category } : {}),
        ...(position !== undefined ? { position } : {}),
        ...(isDefault ? { isDefault: true } : {}),
      },
    );
    if (json) this.printJson(state);
    else console.log(`Updated state ${state.id}\t${state.name}`);
  };

  workStateDelete = async (
    stateId: string,
    options: ProjectWorkCommandOptions & { migrateTo?: string },
  ): Promise<void> => {
    const result = await this.api<unknown>(
      this.workStatePath(options.project, stateId),
      "DELETE",
      {
        migrateToStateId: options.migrateTo ?? null,
      },
    );
    if (options.json) this.printJson(result);
    else console.log(`Deleted state ${stateId}`);
  };

  private printCreatedProject = (
    project: ProjectRecord,
    json: boolean,
  ): void => {
    if (json) {
      console.log(JSON.stringify(project, null, 2));
      return;
    }
    console.log(`Created project "${project.name}" at ${project.rootPath}`);
  };

  private api = async <T>(
    path: string,
    method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
    body?: unknown,
  ): Promise<T> => {
    return await this.createApiClient().request<T>({
      path,
      method,
      ...(body !== undefined ? { body } : {}),
    });
  };

  private workItemPath = (projectId: string, workItemId: string): string =>
    `/api/projects/${encodeURIComponent(projectId)}/work/items/${encodeURIComponent(workItemId)}`;

  private workStatePath = (projectId: string, stateId: string): string =>
    `/api/projects/${encodeURIComponent(projectId)}/work/states/${encodeURIComponent(stateId)}`;

  private printJson = (value: unknown): void =>
    console.log(JSON.stringify(value, null, 2));

  private printWorkMutation = (
    verb: string,
    item: ProjectWorkItemDetail,
    json: boolean,
  ): void => {
    if (json) return this.printJson(item);
    console.log(
      `${verb} work item ${item.id}\t${item.state.name}\t${item.title}`,
    );
  };

  private withKernel = async <T>(
    action: (kernel: NextclawKernel) => Promise<T>,
  ): Promise<T> => {
    const kernel = this.createKernel();
    try {
      await kernel.projectManager.initialize();
      return await action(kernel);
    } finally {
      await kernel.dispose();
    }
  };
}
