export const CHAT_INLINE_TOKENS_METADATA_KEY = "ui_inline_tokens";
export const CHAT_WORKSPACE_FILE_TOKEN_KIND = "workspace_file";
export const CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND = "workspace_directory";

export type ChatInlineTokenMetadata = {
  kind: string;
  key: string;
  label: string;
  rawText: string;
};
