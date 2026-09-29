import {
  parseThinkingLevel,
  resolveThinkingLevel,
  type Config,
  type SessionProjectContextResolver,
} from "@nextclaw/core";
import type { ResolvedAgentProfile } from "@kernel/managers/agent.manager.js";
import {
  resolveEffectiveModel,
  resolveSessionChannelContext,
  normalizeOptionalString,
} from "@kernel/features/native-runtime/utils/nextclaw-ncp-session-preferences.utils.js";
import {
  resolveAgentHandoffDepth,
  type ToolRunContext,
} from "@kernel/managers/tool-provider.manager.js";

export type NextclawNcpResolvedAgentProfile = {
  agentId: string;
  displayName: string;
  contextTokens: number;
  execTimeoutSeconds: number;
  model: string;
  reservedContextTokens: number;
  restrictToWorkspace: boolean;
  searchConfig: Config["search"];
  workspace: string;
};

export type NextclawNcpRunContextResolveParams = {
  agentProfile: ResolvedAgentProfile;
  config: Config;
  sessionId: string;
  requestMetadata?: Record<string, unknown>;
  sessionMetadata?: Record<string, unknown>;
  projectContextResolver: Pick<SessionProjectContextResolver, "resolve">;
};

export type NextclawNcpResolvedRunContext = {
  channel: string;
  chatId: string;
  config: Config;
  effectiveModel: string;
  effectiveWorkspace: string;
  profile: NextclawNcpResolvedAgentProfile;
  requestMetadata: Record<string, unknown>;
  requestedToolNames: string[];
  runtimeThinking: ReturnType<typeof resolveThinkingLevel>;
  sessionKey: string;
  sessionMetadata: Record<string, unknown>;
  toolRunContext: ToolRunContext;
};

function resolveRequestedToolNames(
  metadata: Record<string, unknown>,
): string[] {
  const rawValue = metadata.requested_tools ?? metadata.requestedTools;
  if (!Array.isArray(rawValue)) {
    return [];
  }
  return Array.from(
    new Set(
      rawValue
        .map((item) => normalizeOptionalString(item))
        .filter((item): item is string => Boolean(item)),
    ),
  );
}

function mergeRunMetadata(params: {
  requestMetadata?: Record<string, unknown>;
  sessionMetadata?: Record<string, unknown>;
}): Record<string, unknown> {
  const { requestMetadata, sessionMetadata } = params;
  return {
    ...(sessionMetadata ? structuredClone(sessionMetadata) : {}),
    ...(requestMetadata ? structuredClone(requestMetadata) : {}),
  };
}

export function buildNextclawNcpRunContext(
  params: NextclawNcpRunContextResolveParams,
): NextclawNcpResolvedRunContext {
  const {
    agentProfile,
    config,
    requestMetadata: inputRequestMetadata,
    sessionId,
    sessionMetadata: inputSessionMetadata,
    projectContextResolver,
  } = params;
  const requestMetadata = mergeRunMetadata({
    sessionMetadata: inputSessionMetadata,
    requestMetadata: inputRequestMetadata,
  });
  const profile = buildResolvedAgentProfile({
    config,
    profile: agentProfile,
    workspace: projectContextResolver.resolve({ workspace: agentProfile.workspace }).hostWorkspace,
  });
  const { metadata: modelMetadata, model: effectiveModel } =
    resolveEffectiveModel({
      sessionMetadata: requestMetadata,
      requestMetadata,
      fallbackModel: profile.model,
    });
  const effectiveWorkspace = projectContextResolver.resolve({
    sessionMetadata: modelMetadata,
    workspace: profile.workspace,
  }).effectiveWorkspace;
  const channelContext = resolveSessionChannelContext({
    sessionMetadata: modelMetadata,
    requestMetadata,
  });
  const sessionMetadata = channelContext.metadata;
  const runtimeThinking = resolveThinkingLevel({
    config,
    agentId: profile.agentId,
    model: effectiveModel,
    sessionThinkingLevel:
      parseThinkingLevel(sessionMetadata.preferred_thinking) ?? null,
  });

  return {
    channel: channelContext.channel,
    chatId: channelContext.chatId,
    config,
    effectiveModel,
    effectiveWorkspace,
    profile,
    requestMetadata,
    requestedToolNames: resolveRequestedToolNames(requestMetadata),
    runtimeThinking,
    sessionKey: sessionId,
    sessionMetadata,
    toolRunContext: {
      sessionId,
      channel: channelContext.channel,
      chatId: channelContext.chatId,
      agentId: profile.agentId,
      config,
      execTimeoutSeconds: profile.execTimeoutSeconds,
      handoffDepth: resolveAgentHandoffDepth(requestMetadata),
      metadata: requestMetadata,
      restrictToWorkspace: profile.restrictToWorkspace,
      searchConfig: profile.searchConfig,
      workspace: effectiveWorkspace,
    },
  };
}

function buildResolvedAgentProfile(params: {
  config: Config;
  profile: ResolvedAgentProfile;
  workspace: string;
}): NextclawNcpResolvedAgentProfile {
  const {
    config,
    profile,
  } = params;
  const {
    search: searchConfig,
    tools: {
      restrictToWorkspace,
      exec: { timeout: execTimeoutSeconds },
    },
  } = config;
  return {
    agentId: profile.id,
    displayName: profile.displayName ?? profile.id,
    workspace: params.workspace,
    model: profile.model,
    contextTokens: profile.contextTokens,
    reservedContextTokens: profile.reservedContextTokens,
    restrictToWorkspace,
    searchConfig,
    execTimeoutSeconds,
  };
}
