import type {
  ProjectManager,
  ProjectWorkManager,
} from "@kernel/features/projects/index.js";
import {
  ProjectsCreateTool,
  ProjectsListTool,
} from "@kernel/tools/project.tools.js";
import {
  ProjectWorkCreateTool,
  ProjectWorkGetTool,
  ProjectWorkListTool,
  ProjectWorkUpdateTool,
} from "@kernel/tools/project-work.tools.js";
import type {
  AgentRunRequest,
  ToolProvider,
} from "@kernel/types/agent-run.types.js";
import type { NcpTool } from "@nextclaw/ncp";
import {
  readProjectId,
  readProjectRoot,
} from "@kernel/utils/session-creation.utils.js";
import type { ToolProviderRunContextService } from "@kernel/contributions/tool-provider/services/tool-provider-run-context.service.js";

export class ProjectToolProvider implements ToolProvider {
  constructor(
    private readonly runContext: ToolProviderRunContextService,
    private readonly projectManager: ProjectManager,
    private readonly projectWork: ProjectWorkManager,
  ) {}

  provide = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    const globalTools: NcpTool[] = [
      new ProjectsListTool(this.projectManager),
      new ProjectsCreateTool(this.projectManager),
    ];
    const resolved = await this.runContext.resolve(request);
    const projectId = readProjectId(resolved.session?.metadata);
    const projectRoot = readProjectRoot(resolved.session?.metadata);
    const project = projectId
      ? await this.projectManager.getProjectById(projectId)
      : projectRoot
        ? await this.projectManager.getRegisteredProject(projectRoot)
        : null;
    if (!project || !resolved.sessionId) return globalTools;
    const context = {
      projectId: project.id,
      sessionId: resolved.sessionId,
      ...(resolved.session?.agentId
        ? { agentId: resolved.session.agentId }
        : {}),
    };
    return [
      ...globalTools,
      new ProjectWorkListTool(this.projectWork, context),
      new ProjectWorkGetTool(this.projectWork, context),
      new ProjectWorkCreateTool(this.projectWork, context),
      new ProjectWorkUpdateTool(this.projectWork, context),
    ];
  };
}
