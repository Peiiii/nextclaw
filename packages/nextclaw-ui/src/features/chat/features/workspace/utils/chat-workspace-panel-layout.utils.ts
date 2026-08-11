export const CHAT_WORKSPACE_PANEL_DEFAULT_WIDTH = 480;
export const CHAT_WORKSPACE_PANEL_MIN_WIDTH = 360;
export const CHAT_WORKSPACE_PANEL_MAX_WIDTH = 860;

export const CHAT_WORKSPACE_EXPLORER_DEFAULT_WIDTH = 224;
export const CHAT_WORKSPACE_EXPLORER_MIN_WIDTH = 192;
export const CHAT_WORKSPACE_EXPLORER_MAX_WIDTH = 400;
export const CHAT_WORKSPACE_EXPLORER_COMPACT_THRESHOLD = 560;

export function normalizeChatWorkspacePanelWidth(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return CHAT_WORKSPACE_PANEL_DEFAULT_WIDTH;
  }
  return Math.max(CHAT_WORKSPACE_PANEL_MIN_WIDTH, Math.min(CHAT_WORKSPACE_PANEL_MAX_WIDTH, value));
}

export function normalizeChatWorkspaceExplorerWidth(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return CHAT_WORKSPACE_EXPLORER_DEFAULT_WIDTH;
  }
  return Math.max(CHAT_WORKSPACE_EXPLORER_MIN_WIDTH, Math.min(CHAT_WORKSPACE_EXPLORER_MAX_WIDTH, value));
}
