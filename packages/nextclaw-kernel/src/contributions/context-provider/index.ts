import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import { Contribution } from "@nextclaw/shared";
import { AgentBootstrapContextProvider } from "./providers/agent-bootstrap-context.provider.js";
import { CurrentSessionContextProvider } from "./providers/current-session-context.provider.js";
import { ConversationExcerptContextProvider } from "./providers/conversation-excerpt-context.provider.js";
import { SystemObjectReferenceContextProvider } from "./providers/system-object-reference-context.provider.js";
import { UiResourceReferenceContextProvider } from "./providers/ui-resource-reference-context.provider.js";
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
export { SystemObjectReferenceContextProvider } from "./providers/system-object-reference-context.provider.js";
export { UiResourceReferenceContextProvider } from "./providers/ui-resource-reference-context.provider.js";

export class ContextProviderContribution extends Contribution {
  constructor(private readonly kernel: NextclawKernel) {
    super();
  }

  protected setup = (): void => {
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
      new ConversationExcerptContextProvider(),
      new WorkspaceReferenceContextProvider(context, this.kernel.projectManager),
      new AgentBootstrapContextProvider(context),
      new WorkspaceMemoryContextProvider(context),
      new SkillsContextProvider(context),
      createSessionOrchestrationContextProvider(),
      new ExecutionPolicyContextProvider(context),
      new SystemObjectReferenceContextProvider(this.kernel.assetStore),
      new UiResourceReferenceContextProvider(),
      new CurrentSessionContextProvider(context),
      new ReplyFormatContextProvider(),
    ]) {
      this.effect(() => this.kernel.contextProviderManager.register(provider));
    }
  };
}
