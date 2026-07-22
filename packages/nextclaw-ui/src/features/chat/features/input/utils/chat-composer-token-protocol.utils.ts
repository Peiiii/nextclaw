import {
  CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND,
  CHAT_WORKSPACE_FILE_TOKEN_KIND,
} from '@nextclaw/shared';

const CHAT_SKILL_TOKEN_PREFIX = '$';
const CHAT_PANEL_APP_TOKEN_PREFIX = '@panel-app:';
const CHAT_WORKSPACE_FILE_TOKEN_PREFIX = '@file:';
const CHAT_WORKSPACE_DIRECTORY_TOKEN_PREFIX = '@folder:';

export function serializeChatComposerTokenText(params: {
  label?: string;
  tokenKey: string;
  tokenKind: string;
}): string | null {
  const { label, tokenKey, tokenKind } = params;
  if (tokenKind === 'skill') {
    return `${CHAT_SKILL_TOKEN_PREFIX}${label?.trim() || tokenKey}`;
  }
  if (tokenKind === 'panel_app') {
    return `${CHAT_PANEL_APP_TOKEN_PREFIX}${tokenKey}`;
  }
  if (tokenKind === CHAT_WORKSPACE_FILE_TOKEN_KIND) {
    return `${CHAT_WORKSPACE_FILE_TOKEN_PREFIX}${encodeURIComponent(tokenKey)}`;
  }
  if (tokenKind === CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND) {
    return `${CHAT_WORKSPACE_DIRECTORY_TOKEN_PREFIX}${encodeURIComponent(tokenKey)}`;
  }
  return null;
}
