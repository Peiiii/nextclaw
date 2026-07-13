export const CHAT_WORKSPACE_PANEL_DEFAULT_WIDTH = 480;
export const CHAT_WORKSPACE_PANEL_MIN_WIDTH = 360;
export const CHAT_WORKSPACE_PANEL_MAX_WIDTH = 860;

export function normalizeChatWorkspacePanelWidth(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return CHAT_WORKSPACE_PANEL_DEFAULT_WIDTH;
  }
  return Math.max(
    CHAT_WORKSPACE_PANEL_MIN_WIDTH,
    Math.min(CHAT_WORKSPACE_PANEL_MAX_WIDTH, value),
  );
}
