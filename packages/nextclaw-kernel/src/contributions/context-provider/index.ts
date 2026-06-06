import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import {
  CurrentSessionContextProvider,
  ExecutionPolicyContextProvider,
  ProjectContextProvider,
  SkillsContextProvider,
  ToolingContextProvider,
  WorkspaceContextProvider,
  WorkspaceMemoryContextProvider,
} from "./providers/native-dynamic-context.provider.js";
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
  createWorkspaceFilesContextProvider,
} from "./providers/native-static-context.provider.js";
import { ReplyFormatContextProvider } from "./providers/reply-format-context.provider.js";
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
      createWorkspaceFilesContextProvider(),
      createReplyTagsContextProvider(),
      createMessagingContextProvider(),
      createMemoryRecallContextProvider(),
      createSilentRepliesContextProvider(),
      createRuntimeContextProvider(),
      createSelfManagementContextProvider(),
      new ProjectContextProvider(context),
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
