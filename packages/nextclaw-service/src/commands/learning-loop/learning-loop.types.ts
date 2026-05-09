import type { SessionManager } from "@nextclaw/core";
import type { GlobalTypedEventBus } from "@nextclaw/core";
import type { LearningLoopRuntimeConfig } from "./learning-loop.config.js";
import type { SessionRequestBroker } from "../ncp/session-request/session-request-broker.service.js";

export type LearningLoopSessionRequester = Pick<
  SessionRequestBroker,
  "spawnSessionAndRequest"
>;

export type LearningLoopSessionStore = Pick<
  SessionManager,
  "getIfExists" | "save"
>;

export type LearningLoopFeatureConfig = {
  eventBus: GlobalTypedEventBus;
  sessionStore: LearningLoopSessionStore;
  sessionRequester: LearningLoopSessionRequester;
  resolveRuntimeConfig?: () => LearningLoopRuntimeConfig;
  toolCallThreshold?: number;
};
