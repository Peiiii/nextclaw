import type {
  PanelAppBridgeSession,
  PanelAppEntry,
  PanelAppList,
  PanelAppPreferencesUpdate,
  PanelAppAgentCapability,
  PanelAppAgentGenerateObjectRequest,
  PanelAppAgentGenerateObjectResult,
  PanelAppAgentSendRequest,
  PanelAppAgentSendResult,
  PanelAppCapabilityGrant,
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
export type PanelAppAgentCapabilityView = PanelAppAgentCapability;
export type PanelAppAgentGenerateObjectRequestView = PanelAppAgentGenerateObjectRequest;
export type PanelAppAgentGenerateObjectResultView = PanelAppAgentGenerateObjectResult;
export type PanelAppAgentSendRequestView = PanelAppAgentSendRequest;
export type PanelAppAgentSendResultView = PanelAppAgentSendResult;
export type PanelAppCapabilityGrantView = PanelAppCapabilityGrant;
