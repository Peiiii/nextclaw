import type { SessionManager } from "@nextclaw/core";
import type { GlobalTypedEventBus } from "@nextclaw/core";
import type { SessionRequestBroker } from "../session-request/session-request-broker.service.js";

export type LearningReviewSessionRequester = Pick<
  SessionRequestBroker,
  "spawnSessionAndRequest"
>;

export type LearningReviewSessionStore = Pick<
  SessionManager,
  "getIfExists" | "save"
>;

export type LearningReviewFeatureConfig = {
  eventBus: GlobalTypedEventBus;
  sessionStore: LearningReviewSessionStore;
  sessionRequester: LearningReviewSessionRequester;
  toolCallThreshold?: number;
};
