export const CHAT_INLINE_TOKENS_METADATA_KEY = "ui_inline_tokens";
export const CHAT_INLINE_TOKENS_SCHEMA_VERSION = 2;
export const CHAT_WORKSPACE_FILE_TOKEN_KIND = "workspace_file";
export const CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND = "workspace_directory";

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

export type ChatInlineTokenMetadata =
  | ChatSkillInlineTokenMetadata
  | ChatWorkspaceInlineTokenMetadata;

export type ChatInlineTokensMetadata = {
  schemaVersion: typeof CHAT_INLINE_TOKENS_SCHEMA_VERSION;
  items: ChatInlineTokenMetadata[];
};
