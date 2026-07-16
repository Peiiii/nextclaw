import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import { AgentBootstrapContextProvider } from "./providers/agent-bootstrap-context.provider.js";
import { CurrentSessionContextProvider } from "./providers/current-session-context.provider.js";
import { ExecutionPolicyContextProvider } from "./providers/execution-policy-context.provider.js";
import {
  createAssistantIdentityContextProvider,
  createChatComposerTokensContextProvider,
  createCliQuickReferenceContextProvider,
  createMemoryRecallContextProvider,
  createMessagingContextProvider,
  createReplyTagsContextProvider,
  createRuntimeContextProvider,
  createSafetyContextProvider,
  createSelfManagementContextProvider,
  createSelfUpdateContextProvider,
  createSessionOrchestrationContextProvider,
  createSilentRepliesContextProvider,
  createToolCallStyleContextProvider,
} from "./providers/native-static-context.provider.js";
import { ProjectContextProvider } from "./providers/project-context.provider.js";
import { ReplyFormatContextProvider } from "./providers/reply-format-context.provider.js";
import { SkillsContextProvider } from "./providers/skills-context.provider.js";
import { ToolingContextProvider } from "./providers/tooling-context.provider.js";
import { WorkspaceContextProvider } from "./providers/workspace-context.provider.js";
import { WorkspaceMemoryContextProvider } from "./providers/workspace-memory-context.provider.js";
import { WorkspaceReferenceContextProvider } from "./providers/workspace-reference-context.provider.js";
import { ContextProviderRunContextService } from "./services/context-provider-run-context.service.js";

export { ReplyFormatContextProvider } from "./providers/reply-format-context.provider.js";

export class ContextProviderContribution implements KernelContribution {
  private readonly cleanups: Array<() => void> = [];

  constructor(private readonly kernel: NextclawKernel) {}

  start = (): void => {
    if (this.cleanups.length > 0) {
      return;
    }
    const context = new ContextProviderRunContextService(this.kernel);

    for (const provider of [
      createAssistantIdentityContextProvider(),
      new ToolingContextProvider(context),
      createToolCallStyleContextProvider(),
      createChatComposerTokensContextProvider(),
      createSafetyContextProvider(),
      createCliQuickReferenceContextProvider(),
      createSelfUpdateContextProvider(),
      new WorkspaceContextProvider(context),
      createReplyTagsContextProvider(),
      createMessagingContextProvider(),
      createMemoryRecallContextProvider(),
      createSilentRepliesContextProvider(),
      createRuntimeContextProvider(),
      createSelfManagementContextProvider(),
      new ProjectContextProvider(context),
      new WorkspaceReferenceContextProvider(context),
      new AgentBootstrapContextProvider(context),
      new WorkspaceMemoryContextProvider(context),
      new SkillsContextProvider(context),
      createSessionOrchestrationContextProvider(),
      new ExecutionPolicyContextProvider(context),
      new CurrentSessionContextProvider(context),
      new ReplyFormatContextProvider(),
    ]) {
      this.cleanups.push(this.kernel.contextProviderManager.register(provider));
    }
  };

  dispose = (): void => {
    while (this.cleanups.length > 0) {
      this.cleanups.pop()?.();
    }
  };
}
