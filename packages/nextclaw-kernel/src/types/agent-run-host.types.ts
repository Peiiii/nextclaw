import type { AgentManager } from "@kernel/managers/agent.manager.js";
import type { AgentContextWindowManager } from "@kernel/managers/agent-context-window.manager.js";
import type { AgentRuntimeManager } from "@kernel/managers/agent-runtime.manager.js";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import type { SessionRunManager } from "@kernel/managers/session-run.manager.js";

/** Resource contracts consumed by the existing Agent run owner in either host. */
export type AgentRunAgentHost = Pick<AgentManager, "getDefaultAgentId">;
export type AgentRunConfigHost = Pick<ConfigManager, "getDefaultModel" | "getModelMaxTokens">;
export type AgentRunSurfaceHost = Pick<AgentContextWindowManager, "resolveRunSurface">;
export type AgentRunRuntimeHost = Pick<AgentRuntimeManager, "getOrCreate" | "disposeRuntime">;
export type AgentRunSessionHost = Pick<SessionManager,
  "getOrCreateAgentRunSession" | "getAgentRunSession" | "getSessionRecord" |
  "rewindSessionBeforeMessage" | "listSessionMessages">;
export type AgentRunSessionRunHost = Pick<SessionRunManager,
  "getSessionRun" | "getOrCreateSessionRun" | "isSessionRunning">;

/** An acquired platform claim must reject release by a superseded owner. */
export interface SessionExecutionClaim {
  release(): void;
}

export interface SessionExecutionClaims {
  tryAcquire(key: string):
    | { acquired: true; claim: SessionExecutionClaim }
    | { acquired: false };
}
