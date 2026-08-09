export const CHAT_INLINE_TOKENS_METADATA_KEY = "ui_inline_tokens";
export const CHAT_INLINE_TOKENS_SCHEMA_VERSION = 2;
export const CHAT_PROJECT_TOKEN_KIND = "project";
export const CHAT_CONVERSATION_EXCERPT_TOKEN_KIND = "conversation_excerpt";
export const CHAT_WORKSPACE_FILE_TOKEN_KIND = "workspace_file";
export const CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND = "workspace_directory";
export const CHAT_WORKSPACE_EXCERPT_TOKEN_KIND = "workspace_excerpt";

export type ChatSkillSource = "builtin" | "global" | "project" | "workspace";

export type ChatSkillInlineTokenMetadata = {
  kind: "skill";
  ref: string;
  name: string;
  source: ChatSkillSource;
  path: string;
  label: string;
  rawText: string;
};

export type ChatWorkspaceInlineTokenMetadata = {
  kind:
    | typeof CHAT_WORKSPACE_FILE_TOKEN_KIND
    | typeof CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND;
  key: string;
  label: string;
  rawText: string;
};

export type ChatWorkspaceExcerptInlineTokenMetadata = {
  kind: typeof CHAT_WORKSPACE_EXCERPT_TOKEN_KIND;
  key: string;
  path: string;
  label: string;
  excerpt: string;
  startLine: number | null;
  endLine: number | null;
  rawText: string;
};

export type ChatConversationExcerptInlineTokenMetadata = {
  kind: typeof CHAT_CONVERSATION_EXCERPT_TOKEN_KIND;
  key: string;
  messageId: string;
  role: "assistant" | "user";
  label: string;
  excerpt: string;
  rawText: string;
};

export type ChatProjectInlineTokenMetadata = {
  kind: typeof CHAT_PROJECT_TOKEN_KIND;
  key: string;
  label: string;
  rawText: string;
};

export type ChatInlineTokenMetadata =
  | ChatSkillInlineTokenMetadata
  | ChatProjectInlineTokenMetadata
  | ChatWorkspaceInlineTokenMetadata
  | ChatWorkspaceExcerptInlineTokenMetadata
  | ChatConversationExcerptInlineTokenMetadata;

export type ChatInlineTokensMetadata = {
  schemaVersion: typeof CHAT_INLINE_TOKENS_SCHEMA_VERSION;
  items: ChatInlineTokenMetadata[];
};
