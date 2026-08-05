export const INBOX_DELIVERY_SESSION_METADATA_KEY = "inbox_delivery_id";

export type InboxDeliveryContentType = "markdown" | "html";

export type InboxDeliverySource = {
  kind: "agent";
  agentId: string | null;
  sessionId: string | null;
  toolCallId: string | null;
  filePath: string | null;
};

export type InboxDelivery = {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  contentType: InboxDeliveryContentType;
  source: InboxDeliverySource;
  createdAt: string;
  updatedAt: string;
  presentedAt: string | null;
  readAt: string | null;
  archivedAt: string | null;
  conversationSessionId: string | null;
};

export type InboxDeliveryListView = {
  deliveries: InboxDelivery[];
  total: number;
  unreadCount: number;
  unpresentedCount: number;
};

export type InboxDeliveryStateAction =
  | "present"
  | "read"
  | "mark_unread"
  | "archive"
  | "restore";

export type InboxDeliveryStateUpdate = {
  action: InboxDeliveryStateAction;
};

export type InboxDeliveryContinueResult = {
  delivery: InboxDelivery;
  sessionId: string;
  created: boolean;
};

export type InboxDeliveryChangedEventPayload = {
  deliveryId: string;
  operation: "upsert" | "delete";
};
