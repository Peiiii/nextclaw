import type { NcpProviderRuntimeRoute } from "@nextclaw/ncp";

export type OpencodeProviderApiMode =
  | "anthropic_messages"
  | "chat_completions"
  | "codex_responses";

export type OpencodeResolvedRoute = {
  apiBase?: string;
  apiKey: string;
  apiMode: OpencodeProviderApiMode;
  headers?: Record<string, string>;
  modelId: string;
  modelRoute: string;
  providerId: string;
  providerRoute: NcpProviderRuntimeRoute;
};

export type OpencodeAcpRuntimeConfig = {
  args: string[];
  command: string;
  cwd: string;
  env: Record<string, string>;
  providerRoute: NcpProviderRuntimeRoute;
  requestTimeoutMs: number;
  sessionId: string;
  startupTimeoutMs: number;
};
