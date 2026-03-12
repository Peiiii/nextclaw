import type { NcpEndpointEvent } from "../types/events.js";
import type { NcpError } from "../types/errors.js";
import type { NcpMessage } from "../types/message.js";

/**
 * Read-only snapshot of conversation state maintained by a state manager.
 *
 * Consumed by UI or other layers; all updates flow through dispatch(event).
 */
export interface NcpConversationSnapshot {
  /** Ordered list of finalized messages. */
  readonly messages: ReadonlyArray<NcpMessage>;

  /**
   * Message currently being streamed (deltas apply here); null when idle.
   * When message.completed is dispatched, this is appended to messages and cleared.
   */
  readonly streamingMessage: NcpMessage | null;

  /** Latest error, if any (e.g. from message.failed or endpoint.error). */
  readonly error: NcpError | null;
}

/**
 * State manager that holds conversation state and updates it from NCP events.
 *
 * Feed events via dispatch(); subscribe() to be notified on state changes.
 * Typically used by agent UIs or runtimes to keep a single source of truth for messages.
 */
export interface NcpConversationStateManager {
  /** Returns the current snapshot. Call after dispatch or in subscribe callback. */
  getSnapshot(): NcpConversationSnapshot;

  /**
   * Applies an NCP event to internal state (messages, streamingMessage, error).
   * Notifies subscribers after the update.
   */
  dispatch(event: NcpEndpointEvent): Promise<void>;

  /**
   * Subscribes to state changes. Listener is called after each dispatch that mutates state.
   * Returns an unsubscribe function.
   */
  subscribe(listener: (snapshot: NcpConversationSnapshot) => void): () => void;
}
