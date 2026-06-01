export type EventStreamGrant =
  | "event-stream:ui-events"
  | "event-stream:extension-requests"
  | "event-stream:ncp-events"
  | "event-stream:config-events";

export type EventStreamScopeValue = string | string[];

export type EventStreamPrincipal = {
  principalId: string;
  grants: EventStreamGrant[];
  scopes: Record<string, EventStreamScopeValue>;
};

export type ExtensionEventStreamCredential = {
  extensionId: string | null;
  token: string | null;
};

export type ExtensionEventStreamAuthResult = {
  extensionId: string;
};

export type ExtensionEventStreamAuthenticator = {
  authenticateEventStreamCredential: (
    input: ExtensionEventStreamCredential,
  ) => ExtensionEventStreamAuthResult | null;
};
