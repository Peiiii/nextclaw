import type { NcpEndpointEvent, NcpEndpointSubscriber } from "./events.js";
import type { NcpEndpointManifest } from "./manifest.js";

// ---------------------------------------------------------------------------
// Endpoint contract
// ---------------------------------------------------------------------------

/**
 * Core interface every NCP endpoint adapter must implement.
 *
 * An endpoint is a named, lifecycle-managed communication channel.
 * Single primitive: emit(event) to send, subscribe(listener) to receive.
 * Event types and payloads are defined in events.ts (aligned with agent-chat).
 *
 * @example
 * const endpoint: NcpEndpoint = new MyAgentEndpoint(options);
 * await endpoint.start();
 * endpoint.subscribe((event) => { ... });
 * await endpoint.emit({ type: "message.request", payload: envelope });
 */
export interface NcpEndpoint {
  /** Static capability declaration — available before `start()` is called. */
  readonly manifest: NcpEndpointManifest;

  /**
   * Initializes the endpoint (opens connections, authenticates, etc.).
   * Must be called before `emit`. Idempotent — safe to call more than once.
   */
  start(): Promise<void>;

  /**
   * Gracefully shuts down the endpoint and releases resources.
   * Idempotent — safe to call more than once.
   */
  stop(): Promise<void>;

  /**
   * Sends an event to the remote participant (or broadcasts to local subscribers).
   *
   * For outbound events (e.g. message.request, message.abort), the implementation
   * forwards to the wire. For symmetric in-process setups, it may broadcast locally.
   */
  emit(event: NcpEndpointEvent): Promise<void>;

  /**
   * Subscribes to endpoint events.
   *
   * @param listener - Called for every event emitted by this endpoint.
   * @returns An unsubscribe function. Call it to stop receiving events.
   *
   * @example
   * const unsubscribe = endpoint.subscribe((event) => {
   *   if (event.type === "message.completed") handleReply(event.payload);
   * });
   * unsubscribe();
   */
  subscribe(listener: NcpEndpointSubscriber): () => void;
}
