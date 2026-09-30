import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import { Contribution } from "@nextclaw/shared";
import { SessionProjectContextResolver } from "@nextclaw/core";
import { createLocalContextResources } from "@kernel/app/local-agent-resources.factory.js";
import { AgentBootstrapContextProvider } from "./providers/agent-bootstrap-context.provider.js";
import { CurrentSessionContextProvider } from "./providers/current-session-context.provider.js";
import { ConversationExcerptContextProvider } from "./providers/conversation-excerpt-context.provider.js";
import { SystemObjectReferenceContextProvider } from "./providers/system-object-reference-context.provider.js";
import { UiResourceReferenceContextProvider } from "./providers/ui-resource-reference-context.provider.js";
import { ExecutionPolicyContextProvider } from "./providers/execution-policy-context.provider.js";
import {
  createChatComposerTokensContextProvider,
  createCliQuickReferenceContextProvider,
  createMemoryRecallContextProvider,
  createMessagingContextProvider,
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
export type { BootstrapContextInput } from "./utils/bootstrap-context.utils.js";
export type { ContextRuntimeInfo } from "./providers/current-session-context.provider.js";

export class ContextProviderContribution extends Contribution {
  constructor(private readonly kernel: NextclawKernel, private readonly profile: "default" | "embedded" = "default") {
    super();
  }

  protected setup = (): void => {
    const context = new ContextProviderRunContextService(this.kernel, new SessionProjectContextResolver());
    const { contextFiles: files, runtimeInfo: runtime } = createLocalContextResources({ configPath: this.kernel.configManager.configPath });

    const safety = createSafetyContextProvider();
    const executionPolicy = new ExecutionPolicyContextProvider(context);
    const providers = this.profile === "embedded" ? [
      safety,
      new AgentBootstrapContextProvider(context, files),
      new WorkspaceMemoryContextProvider(context, files),
      executionPolicy,
      new CurrentSessionContextProvider(context, runtime),
    ] : [
      createToolCallStyleContextProvider(),
      createChatComposerTokensContextProvider(),
      safety,
      createCliQuickReferenceContextProvider(),
      createSelfUpdateContextProvider(),
      createMessagingContextProvider(),
      createMemoryRecallContextProvider(),
      createSilentRepliesContextProvider(),
      createSelfManagementContextProvider(),
      createSessionOrchestrationContextProvider(),
      new ReplyFormatContextProvider(),
      new ToolingContextProvider(context),
      new WorkspaceContextProvider(context),
      new ProjectContextProvider(context),
      new ConversationExcerptContextProvider(),
      new WorkspaceReferenceContextProvider(context, this.kernel.projectManager),
      new AgentBootstrapContextProvider(context, files),
      new WorkspaceMemoryContextProvider(context, files),
      new SkillsContextProvider(context),
      executionPolicy,
      new SystemObjectReferenceContextProvider(this.kernel.assetStore),
      new UiResourceReferenceContextProvider(),
      new CurrentSessionContextProvider(context, runtime),
    ];
    for (const provider of providers) {
      this.effect(() => this.kernel.contextProviderManager.register(provider));
    }
  };
}
