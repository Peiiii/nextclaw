import type { ProjectManager } from "@kernel/managers/project.manager.js";
import { ProjectsCreateTool, ProjectsListTool } from "@kernel/tools/project.tools.js";
import type { AgentRunRequest, ToolProvider } from "@kernel/types/agent-run.types.js";
import type { NcpTool } from "@nextclaw/ncp";

export class ProjectToolProvider implements ToolProvider {
  constructor(private readonly projectManager: ProjectManager) {}

  provide = (_request: AgentRunRequest): readonly NcpTool[] => [
    new ProjectsListTool(this.projectManager),
    new ProjectsCreateTool(this.projectManager),
  ];
}
