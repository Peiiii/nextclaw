import type { CodexOptions, ThreadOptions } from "@openai/codex-sdk";
import type {
  NcpAgentConversationStateManager,
  NcpAgentRunInput,
} from "@nextclaw/ncp";
import type {
  CodexAssetContentPathResolver,
  CodexThreadInput,
} from "@/codex-input.utils.js";
import type { CodexDesktopThreadIndexSync } from "@/services/codex-desktop-thread-index-sync.service.js";

export type JsonObject = Record<string, unknown>;

export type AppServerNotification = {
  method: string;
  params: JsonObject;
};

export type AppServerThreadItem = JsonObject & {
  id?: unknown;
  type?: unknown;
  text?: unknown;
  summary?: unknown;
  content?: unknown;
};

export type CodexAppServerNcpAgentRuntimeConfig = {
  sessionId: string;
  apiKey: string;
  apiBase?: string;
  model?: string;
  threadId?: string | null;
  codexPathOverride?: string;
  env?: Record<string, string>;
  cliConfig?: CodexOptions["config"];
  threadOptions?: ThreadOptions;
  sessionMetadata?: Record<string, unknown>;
  setSessionMetadata?: (nextMetadata: Record<string, unknown>) => void | Promise<void>;
  inputBuilder?: (input: NcpAgentRunInput) => Promise<CodexThreadInput> | CodexThreadInput;
  resolveAssetContentPath?: CodexAssetContentPathResolver;
  stateManager?: NcpAgentConversationStateManager;
  desktopThreadIndexSync?: CodexDesktopThreadIndexSync | false;
};
