export { EventStreamAuthService } from "./services/event-stream-auth.service.js";
export { EventStreamClientRegistry } from "./services/event-stream-client-registry.service.js";
export { canStreamAppEventToPrincipal } from "./utils/event-stream-authorizer.utils.js";
export type {
  ExtensionEventStreamAuthResult,
  ExtensionEventStreamAuthenticator,
  ExtensionEventStreamCredential,
  EventStreamGrant,
  EventStreamPrincipal,
  EventStreamScopeValue,
} from "./types/event-stream-principal.types.js";
