import {
  ContextWindowBudgetService,
  findEffectiveAgentProfile,
  getWorkspacePath,
  parseThinkingLevel,
  RequestedSkillsMetadataReader,
  resolveDefaultAgentProfileId,
  resolveSessionWorkspacePath,
  resolveThinkingLevel,
  type Config,
} from "@nextclaw/core";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import {
  resolveEffectiveModel,
  resolveSessionChannelContext,
  normalizeOptionalString,
} from "@kernel/features/native-runtime/utils/nextclaw-ncp-session-preferences.utils.js";
import {
  resolveAgentHandoffDepth,
  type ToolRunContext,
} from "@kernel/managers/tool.manager.js";

export type NextclawNcpResolvedAgentProfile = {
  agentId: string;
  contextTokens: number;
  execTimeoutSeconds: number;
  model: string;
  reservedContextTokens: number;
  restrictToWorkspace: boolean;
  searchConfig: Config["search"];
  workspace: string;
};

export type NextclawNcpRunContextParams = {
  configManager: ConfigManager;
  sessionId: string;
  requestMetadata?: Record<string, unknown>;
  sessionMetadata?: Record<string, unknown>;
  storedAgentId?: string;
};

export type NextclawNcpResolvedRunContext = {
  channel: string;
  chatId: string;
  config: Config;
  effectiveModel: string;
  effectiveWorkspace: string;
  profile: NextclawNcpResolvedAgentProfile;
  requestMetadata: Record<string, unknown>;
  requestedSkills: ReturnType<RequestedSkillsMetadataReader["readSelection"]>;
  requestedToolNames: string[];
  runtimeThinking: ReturnType<typeof resolveThinkingLevel>;
  sessionKey: string;
  sessionMetadata: Record<string, unknown>;
  toolRunContext: ToolRunContext;
};

const REQUESTED_SKILLS_METADATA_READER = new RequestedSkillsMetadataReader();

function readRequestedAgentId(metadata: Record<string, unknown>): string | null {
  return normalizeOptionalString(metadata.agent_id)?.toLowerCase() ??
    normalizeOptionalString(metadata.agentId)?.toLowerCase() ??
    null;
}

function resolveAgentProfile(params: {
  config: Config;
  requestMetadata: Record<string, unknown>;
  storedAgentId?: string;
}): NextclawNcpResolvedAgentProfile {
  const { config, requestMetadata, storedAgentId } = params;
  const {
    agents: { defaults },
    search: searchConfig,
    tools: {
      restrictToWorkspace,
      exec: { timeout: execTimeoutSeconds },
    },
  } = config;
  const defaultAgentId = resolveDefaultAgentProfileId(config);
  const candidateAgentId =
    normalizeOptionalString(storedAgentId)?.toLowerCase() ??
    readRequestedAgentId(requestMetadata) ??
    defaultAgentId;
  const profile =
    findEffectiveAgentProfile(config, candidateAgentId) ??
    findEffectiveAgentProfile(config, defaultAgentId);
  if (!profile) {
    throw new Error(`default agent profile not found: ${defaultAgentId}`);
  }
  const contextTokens = profile.contextTokens ?? defaults.contextTokens;
  return {
    agentId: profile.id,
    workspace: getWorkspacePath(profile.workspace ?? defaults.workspace),
    model: profile.model ?? defaults.model,
    contextTokens,
    reservedContextTokens: ContextWindowBudgetService.resolveReservedContextTokens({
      contextTokens,
      configuredReservedContextTokens: profile.reservedContextTokens ?? defaults.reservedContextTokens,
    }),
    restrictToWorkspace,
    searchConfig,
    execTimeoutSeconds,
  };
}

function resolveRequestedToolNames(metadata: Record<string, unknown>): string[] {
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

export function buildSessionOrchestrationSection(): string {
  return [
    "## Session Orchestration",
    "- Before passing a non-default `runtime` to `sessions_spawn` or agent creation/update flows, inspect the installed runtime kinds with `nextclaw agents runtimes --json`.",
    "- `sessions_spawn` is the unified session-creation tool. Omit `scope` or use `scope=\"standalone\"` for a regular session, and use `scope=\"child\"` when the new session should be a child session of the current flow.",
    "- `sessions_spawn` only creates the session by default. Add top-level `notify: \"none\" | \"final_reply\"` when the new session should start working immediately.",
    "- When `sessions_spawn.scope=\"child\"` and `sessions_spawn.notify=\"final_reply\"`, the new child session starts right away and this session automatically continues after that child reaches its final reply.",
    "- Use `sessions_spawn` without `notify` when the user wants a separate thread created now but does not need it to start working yet.",
    "- Use `sessions_request` to send one task to an existing session, including a session that was just created by `sessions_spawn` or a previously created child session.",
    "- `sessions_request.target` must be an object shaped like `{ \"session_id\": \"<target-session-id>\" }`. Do not pass a bare string.",
    "- Prefer `notify=\"final_reply\"` when the current session should continue after the target session produces its final reply. Use `notify=\"none\"` when you only want the target session to run independently.",
  ].join("\n");
}

export function resolveNextclawNcpRunContext(
  params: NextclawNcpRunContextParams,
): NextclawNcpResolvedRunContext {
  const {
    configManager,
    requestMetadata: inputRequestMetadata,
    sessionId,
    sessionMetadata: inputSessionMetadata,
    storedAgentId,
  } = params;
  const config = configManager.loadConfig();
  const requestMetadata = mergeRunMetadata({
    sessionMetadata: inputSessionMetadata,
    requestMetadata: inputRequestMetadata,
  });
  const profile = resolveAgentProfile({
    config,
    storedAgentId,
    requestMetadata,
  });
  const { metadata: modelMetadata, model: effectiveModel } = resolveEffectiveModel({
    sessionMetadata: requestMetadata,
    requestMetadata,
    fallbackModel: profile.model,
  });
  const effectiveWorkspace = resolveSessionWorkspacePath({
    sessionMetadata: modelMetadata,
    workspace: profile.workspace,
  });
  const channelContext = resolveSessionChannelContext({
    sessionMetadata: modelMetadata,
    requestMetadata,
  });
  const sessionMetadata = channelContext.metadata;
  const requestedSkills = REQUESTED_SKILLS_METADATA_READER.readSelection(requestMetadata);
  const runtimeThinking = resolveThinkingLevel({
    config,
    agentId: profile.agentId,
    model: effectiveModel,
    sessionThinkingLevel: parseThinkingLevel(sessionMetadata.preferred_thinking) ?? null,
  });

  return {
    channel: channelContext.channel,
    chatId: channelContext.chatId,
    config,
    effectiveModel,
    effectiveWorkspace,
    profile,
    requestMetadata,
    requestedSkills,
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
