import type { ContextProviderRunContextService } from "@kernel/contributions/context-provider/services/context-provider-run-context.service.js";
import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";
import {
  DEFAULT_WORKSPACE_REPOSITORY_IDENTITY_RESOLVER,
  type SessionProjectContext,
  type WorkspaceRepositoryIdentity,
} from "@nextclaw/core";

export class ProjectContextProvider implements ContextProvider {
  constructor(private readonly context: ContextProviderRunContextService) {}

  provide = async (
    request: AgentRunRequest,
  ): Promise<readonly ContextBlock[]> => {
    const { projectContext } = await this.context.resolve(request);
    const repositoryIdentity =
      DEFAULT_WORKSPACE_REPOSITORY_IDENTITY_RESOLVER.resolve(
        projectContext.effectiveWorkspace,
      );

    return [
      this.buildProjectSection({
        projectContext,
        repositoryIdentity,
      }),
    ];
  };

  private buildProjectSection = (params: {
    projectContext: SessionProjectContext;
    repositoryIdentity: WorkspaceRepositoryIdentity;
  }): string => {
    const { projectContext, repositoryIdentity } = params;
    const lines = [
      "# Project Context",
      "",
      `Active project directory: ${projectContext.effectiveWorkspace}`,
    ];

    if (projectContext.projectRoot) {
      lines.push(
        `Session-bound project root: ${projectContext.projectRoot}`,
        "This session is explicitly bound to that project directory. Use it as the primary repo and file-operation context for the user's work.",
      );
    } else {
      lines.push(
        "No explicit session project root is set. Use the active project directory as the primary repo and file-operation context for the user's work.",
      );
    }

    lines.push(...this.buildRepositoryIdentityLines(repositoryIdentity));

    return lines.join("\n");
  };

  private buildRepositoryIdentityLines = (
    repositoryIdentity: WorkspaceRepositoryIdentity,
  ): string[] => {
    if (!repositoryIdentity.repoRoot) {
      return [
        "No Git repository metadata was detected for the active project directory. Do not assume external repository URLs refer to this project unless the user explicitly says so.",
      ];
    }

    const lines = [`Repository root: ${repositoryIdentity.repoRoot}`];

    if (repositoryIdentity.canonicalWebUrl) {
      lines.push(`Canonical repository: ${repositoryIdentity.canonicalWebUrl}`);
    } else if (repositoryIdentity.canonicalRemoteUrl) {
      const remoteLabel = repositoryIdentity.canonicalRemoteName
        ? ` (${repositoryIdentity.canonicalRemoteName})`
        : "";
      lines.push(
        `Canonical git remote${remoteLabel}: ${repositoryIdentity.canonicalRemoteUrl}`,
      );
    }

    lines.push(
      "Repository identity rule: treat any other repository URL mentioned in this context as an external reference unless it exactly matches the canonical repository above.",
    );

    return lines;
  };
}
