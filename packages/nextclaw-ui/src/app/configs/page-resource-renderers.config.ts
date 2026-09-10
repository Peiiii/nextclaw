import { SYSTEM_OBJECT_RESOURCE_RENDERERS } from "@/features/right-panel-resources";
import { WORKSPACE_FILE_PANEL_RENDERERS } from "@/features/right-panel-resources";
import { CHAT_SESSION_PANEL_RENDERERS } from "@/features/chat";
import { PANEL_APPS_DOC_BROWSER_RENDERERS } from "@/features/panel-apps";
import { MARKETPLACE_DETAIL_DOC_BROWSER_RENDERERS } from "@/features/marketplace";

export const PAGE_RESOURCE_RENDERERS = {
  ...SYSTEM_OBJECT_RESOURCE_RENDERERS,
  ...WORKSPACE_FILE_PANEL_RENDERERS,
  ...CHAT_SESSION_PANEL_RENDERERS,
  ...PANEL_APPS_DOC_BROWSER_RENDERERS,
  ...MARKETPLACE_DETAIL_DOC_BROWSER_RENDERERS,
};
