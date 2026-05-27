import type {
  PanelAppBridgeSession,
  PanelAppEntry,
  PanelAppList,
  PanelAppPreferencesUpdate,
} from "@nextclaw/kernel";

export type PanelAppBridgeSessionCreateRequest = {
  panelAppId: string;
  tabId: string;
};

export type PanelAppBridgeSessionView = Pick<
  PanelAppBridgeSession,
  "expiresAt" | "id" | "panelAppId" | "tabId" | "token"
>;

export type PanelAppEntryView = PanelAppEntry;
export type PanelAppListView = PanelAppList;
export type PanelAppPreferencesUpdateView = PanelAppPreferencesUpdate;
