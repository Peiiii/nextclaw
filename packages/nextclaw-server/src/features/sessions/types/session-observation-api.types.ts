import type { ObservationRelationshipStatus } from "@nextclaw/kernel";

export type UiNcpSessionObservationKind = "context" | "events";

export type UiNcpSessionObservationView = {
  id: string;
  kind: UiNcpSessionObservationKind;
  extensionId: string;
  title: string;
  description?: string;
  status: ObservationRelationshipStatus;
  statusReason?: string;
  createdAt: string;
  expiresAt?: string;
  lastReadAt?: string;
  safeConfigPreview?: string;
  pendingCount?: number;
  suppressedCount?: number;
  deliveryFailureCount?: number;
  lastSuppressionReason?: string;
  lastGapAt?: string;
  gapReason?: string;
  delivery?: "queue" | "prefer-steer";
};

export type UiNcpSessionObservationsView = {
  sessionId: string;
  bindings: UiNcpSessionObservationView[];
  subscriptions: UiNcpSessionObservationView[];
  counts: {
    total: number;
    context: number;
    events: number;
    needsAttention: number;
  };
};
