import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import {
  createCronJobSystemObjectProvider,
  createInboxDeliverySystemObjectProvider,
} from "@kernel/managers/system-object-reference.manager.js";
import { createSkillResourceProvider } from "./skill-resource-provider.utils.js";
import type { ServiceAppManager } from "@kernel/managers/service-app.manager.js";
import type { PanelAppManager } from "@kernel/managers/panel-app.manager.js";
import type { McpManager } from "@kernel/managers/mcp.manager.js";
import type { ProjectWorkManager } from "@kernel/features/projects/index.js";
import { statSync } from "node:fs";
import { createPanelAppResourceUri, createSystemObjectReferenceUri } from "@nextclaw/shared";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import type { ProjectManager } from "@kernel/features/projects/index.js";
import type {
  SystemObjectReferenceProvider,
  SystemObjectReferenceSnapshotSource,
} from "@kernel/managers/system-object-reference.manager.js";

function snapshot(
  type: string,
  id: string,
  title: string,
  updatedAt: string,
  content: string,
): SystemObjectReferenceSnapshotSource {
  return {
    item: {
      uri: createSystemObjectReferenceUri(type, id),
      objectType: type,
      objectId: id,
      label: title,
      updatedAt,
      description: null,
    },
    content,
    fileName: `${type}.md`,
    mimeType: "text/markdown",
  };
}

export function createAgentResourceProvider(
  agents: AgentManager,
  configPath: string,
): SystemObjectReferenceProvider {
  const resolve = (id: string) => {
    const agent = agents.getAgent(id);
    if (!agent) return null;
    // A profile has no separate timestamp; use its owning configuration's actual mtime.
    const updatedAt = statSync(configPath).mtime.toISOString();
    const title = agent.displayName || agent.id;
    return snapshot(
      "agent",
      id,
      title,
      updatedAt,
      [
        `# ${title}`,
        "",
        agent.description || "",
        "",
        `- ID: ${id}`,
        `- Workspace: ${agent.workspace}`,
        `- Runtime: ${agent.runtime || "native"}`,
      ].join("\n"),
    );
  };
  return {
    group: {
      objectType: "agent",
      label: { default: "Agents", translations: { zh: "Agent" } },
      description: {
        default: "Reference an agent profile without credentials.",
        translations: { zh: "引用 Agent 身份，不包含凭据或运行配置。" },
      },
      icon: "agent",
      order: 400,
    },
    list: () =>
      agents.listAgents().flatMap((agent) => {
        const result = resolve(agent.id);
        return result ? [result.item] : [];
      }),
    resolve,
  };
}

export function createProjectResourceProvider(
  projects: ProjectManager,
): SystemObjectReferenceProvider {
  const toSnapshot = (
    project: Awaited<ReturnType<ProjectManager["listProjects"]>>[number],
  ) =>
    snapshot(
      "project",
      project.id,
      project.name,
      project.updatedAt,
      [
        `# ${project.name}`,
        "",
        `- ID: ${project.id}`,
        `- Root: ${project.rootPath}`,
        `- Created: ${project.createdAt}`,
        `- Updated: ${project.updatedAt}`,
      ].join("\n"),
    );
  return {
    group: {
      objectType: "project",
      label: { default: "Projects", translations: { zh: "项目" } },
      description: {
        default: "Reference a registered project.",
        translations: { zh: "引用已登记项目及其来源目录。" },
      },
      icon: "project",
      order: 500,
    },
    list: async () =>
      (await projects.listProjects()).map(
        (project) => toSnapshot(project).item,
      ),
    resolve: async (id) => {
      const project = await projects.getProjectById(id);
      return project ? toSnapshot(project) : null;
    },
  };
}

export function createPanelAppResourceProvider(
  apps: PanelAppManager,
): SystemObjectReferenceProvider {
  const toSnapshot = (app: Awaited<ReturnType<PanelAppManager["listPanelApps"]>>["entries"][number]) => {
    const result = snapshot("panel-app", app.id, app.title, app.updatedAt, [
      `# ${app.title}`,
      "",
      app.description ?? "",
      "",
      `[Open application](${createPanelAppResourceUri(app.appId)})`,
      "",
      `- ID: ${app.id}`,
      `- App ID: ${app.appId}`,
      `- Kind: ${app.kind}`,
      `- Source: ${app.sourceKind}`,
    ].join("\n"));
    result.item.description = [app.appId, app.description].filter(Boolean).join(" — ");
    return result;
  };
  return {
    group: {
      objectType: "panel-app",
      label: { default: "Panel apps", translations: { zh: "Panel 应用" } },
      description: {
        default: "Reference an installed panel application and its original page link.",
        translations: { zh: "引用已安装的 Panel 应用及其原始页面链接。" },
      },
      icon: "panel-app",
      order: 550,
    },
    list: async () => (await apps.listPanelApps()).entries.map((app) => toSnapshot(app).item),
    resolve: async (id) => {
      const app = (await apps.listPanelApps()).entries.find((entry) => entry.id === id);
      return app ? toSnapshot(app) : null;
    },
  };
}

export function createServiceAppResourceProvider(
  apps: ServiceAppManager,
): SystemObjectReferenceProvider {
  const toSnapshot = (
    app: Awaited<
      ReturnType<ServiceAppManager["listServiceApps"]>
    >["entries"][number],
  ) =>
    snapshot(
      "service-app",
      app.id,
      app.title,
      statSync(app.manifestPath).mtime.toISOString(),
      [
        `# ${app.title}`,
        "",
        app.description ?? "",
        "",
        `- ID: ${app.id}`,
        `- Enabled: ${app.enabled}`,
        `- Status: ${app.status}`,
        `- Protocol: ${app.protocol}`,
        `- Source: ${app.sourceKind ?? "workspace"}`,
      ].join("\n"),
    );
  return {
    group: {
      objectType: "service-app",
      label: { default: "Service apps", translations: { zh: "服务应用" } },
      description: {
        default: "Reference service identity and status without credentials.",
        translations: { zh: "引用服务应用身份与状态，不包含凭据。" },
      },
      icon: "panel-app",
      order: 600,
    },
    list: async () =>
      (await apps.listServiceApps()).entries.map((app) => toSnapshot(app).item),
    resolve: async (id) => {
      const app = (await apps.listServiceApps()).entries.find(
        (entry) => entry.id === id,
      );
      return app ? toSnapshot(app) : null;
    },
  };
}

export function createMcpResourceProvider(
  mcp: McpManager,
  configPath: string,
): SystemObjectReferenceProvider {
  const toSnapshot = (server: ReturnType<McpManager["listServers"]>[number]) =>
    snapshot(
      "mcp-server",
      server.name,
      server.name,
      statSync(configPath).mtime.toISOString(),
      [
        `# ${server.name}`,
        "",
        `- ID: ${server.name}`,
        `- Enabled: ${server.definition.enabled}`,
        `- Transport: ${server.definition.transport.type}`,
      ].join("\n"),
    );
  return {
    group: {
      objectType: "mcp-server",
      label: { default: "MCP servers", translations: { zh: "MCP 连接" } },
      description: {
        default:
          "Reference a registered connection without URLs, arguments, headers or secrets.",
        translations: { zh: "引用已注册连接，不包含地址、参数、请求头或密钥。" },
      },
      icon: "mcp",
      order: 700,
    },
    list: () => mcp.listServers().map((server) => toSnapshot(server).item),
    resolve: (id) => {
      const server = mcp.listServers().find((entry) => entry.name === id);
      return server ? toSnapshot(server) : null;
    },
  };
}

export function createProjectWorkResourceProvider(
  projects: ProjectManager,
  work: ProjectWorkManager,
): SystemObjectReferenceProvider {
  const toSnapshot = (item: {
    id: string;
    projectId: string;
    title: string;
    description: string;
    stateId: string;
    attention: string;
    updatedAt: string;
  }) =>
    snapshot(
      "project-work",
      JSON.stringify([item.projectId, item.id]),
      item.title,
      item.updatedAt,
      [
        `# ${item.title}`,
        "",
        item.description,
        "",
        `- Project: ${item.projectId}`,
        `- ID: ${item.id}`,
        `- State: ${item.stateId}`,
        `- Attention: ${item.attention}`,
      ].join("\n"),
    );
  return {
    group: {
      objectType: "project-work",
      label: {
        default: "Project work items",
        translations: { zh: "项目工作项" },
      },
      description: { default: "Reference a registered project's work item.", translations: { zh: "引用已注册项目中的工作项。" } },
      icon: "work",
      order: 800,
    },
    list: async () => {
      const items = [];
      for (const project of await projects.listProjects()) {
        let cursor: string | undefined;
        do {
          const page = await work.list(project.id, { limit: 100, cursor });
          items.push(...page.items.map((item) => toSnapshot(item).item));
          cursor = page.nextCursor ?? undefined;
        } while (cursor);
      }
      return items;
    },
    resolve: async (id) => {
      let keys: unknown;
      try {
        keys = JSON.parse(id);
      } catch {
        return null;
      }
      if (
        !Array.isArray(keys) ||
        keys.length !== 2 ||
        keys.some((key) => typeof key !== "string") ||
        JSON.stringify(keys) !== id
      )
        return null;
      if (!(await projects.getProjectById(keys[0]))) return null;
      try {
        const item = await work.get(keys[0], keys[1]);
        return item.deletedAt ? null : toSnapshot(item);
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "PROJECT_WORK_ITEM_NOT_FOUND"
        )
          return null;
        throw error;
      }
    },
  };
}

/** The registration set is kept together; every consumer discovers this same catalog. */
export function createKernelResourceProviders(
  kernel: NextclawKernel,
): SystemObjectReferenceProvider[] {
  return [
    createInboxDeliverySystemObjectProvider(kernel.inboxDeliveryManager),
    createCronJobSystemObjectProvider(kernel.automation),
    createSkillResourceProvider(kernel.skills, {
      projects: kernel.projectManager,
      materials: kernel.projectMaterials,
    }),
    createAgentResourceProvider(kernel.agents, kernel.configManager.configPath),
    createProjectResourceProvider(kernel.projectManager),
    createPanelAppResourceProvider(kernel.panelAppManager),
    createServiceAppResourceProvider(kernel.serviceAppManager),
    createMcpResourceProvider(
      kernel.mcpManager,
      kernel.configManager.configPath,
    ),
    createProjectWorkResourceProvider(
      kernel.projectManager,
      kernel.projectWorkManager,
    ),
  ];
}
