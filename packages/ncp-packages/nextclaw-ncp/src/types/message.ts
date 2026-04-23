/**
 * Participants in an NCP conversation.
 *
 * - `user`      — A human end-user interacting with the system.
 * - `assistant` — An AI model generating responses.
 * - `system`    — Configuration or instruction injected before the conversation.
 * - `tool`      — The result returned by a tool invocation.
 * - `service`   — A platform-side notification or event (e.g. a bot posting a card),
 *                 distinct from an AI assistant response.
 */
export type NcpMessageRole = "user" | "assistant" | "system" | "tool" | "service";

export const NCP_INTERNAL_VISIBILITY_METADATA_KEY = "ncp_internal_visibility";

export function isHiddenNcpMessage(message: Pick<NcpMessage, "metadata"> | null | undefined): boolean {
  return message?.metadata?.[NCP_INTERNAL_VISIBILITY_METADATA_KEY] === "hidden";
}

/**
 * Lifecycle state of a message.
 *
 * Applies to both streaming and non-streaming endpoints:
 * - `pending`   — Created but not yet sent or received.
 * - `streaming` — Actively receiving incremental deltas.
 * - `final`     — Fully received; no further updates expected.
 * - `error`     — Terminated with an error; `parts` may be incomplete.
 */
export type NcpMessageStatus = "pending" | "streaming" | "final" | "error";

// ---------------------------------------------------------------------------
// Core portable parts
// ---------------------------------------------------------------------------

/** Plain text content. The most common part type. */
export type NcpTextPart = {
  type: "text";
  text: string;
};

/**
 * A file attachment, delivered either as a URL or inline Base64 content.
 *
 * `url` and `contentBase64` are mutually exclusive — populate exactly one.
 */
export type NcpFilePart = {
  type: "file";
  name?: string;
  mimeType?: string;
  /** Stable logical asset reference managed by the hosting app. */
  assetUri?: string;
  /** Remote URL pointing to the file. Mutually exclusive with `contentBase64`. */
  url?: string;
  /** Inline file content encoded as Base64. Mutually exclusive with `url`. */
  contentBase64?: string;
  sizeBytes?: number;
};

/** A cited source or reference, typically surfaced alongside AI-generated content. */
export type NcpSourcePart = {
  type: "source";
  title?: string;
  url?: string;
  /** Short excerpt from the source relevant to the message. */
  snippet?: string;
};

/**
 * Marks the beginning of a logical reasoning step in a multi-step response.
 * Used by chain-of-thought or agentic flows to delimit discrete steps.
 */
export type NcpStepStartPart = {
  type: "step-start";
  stepId?: string;
  /** Human-readable label for the step (e.g. "Searching the web"). */
  title?: string;
};

// ---------------------------------------------------------------------------
// Agent-oriented parts
// ---------------------------------------------------------------------------

/** Internal reasoning text produced by the model before its final response. */
export type NcpReasoningPart = {
  type: "reasoning";
  text: string;
};

export type NcpToolOutputTextItem = {
  type: "input_text";
  text: string;
};

export type NcpToolOutputImageItem = {
  type: "input_image";
  imageUrl: string;
  mimeType?: string;
  detail?: "low" | "high" | "auto" | "original";
  originalDataChars?: number;
  dataOmitted?: boolean;
};

export type NcpToolOutputContentItem =
  | NcpToolOutputTextItem
  | NcpToolOutputImageItem;

/**
 * Represents a tool call and its lifecycle.
 *
 * State semantics (aligned with the Vercel AI SDK convention):
 * - `"call"`         — The model has emitted a complete tool call; `args` is populated.
 * - `"partial-call"` — Arguments are still being streamed; `args` may be incomplete.
 * - `"result"`       — The tool has returned; `result` is populated.
 * - `"cancelled"`    — The tool was interrupted before a result was delivered.
 */
export type NcpToolInvocationPart = {
  type: "tool-invocation";
  toolName: string;
  toolCallId?: string;
  state?: "call" | "partial-call" | "result" | "cancelled";
  /** Tool input arguments. May be partial when `state === "partial-call"`. */
  args?: unknown;
  /** Tool output. Populated when `state === "result"`. */
  result?: unknown;
  /** Model-visible structured output items. Text is bounded; images remain image items. */
  resultContentItems?: NcpToolOutputContentItem[];
};

// ---------------------------------------------------------------------------
// Collaboration-platform parts
// ---------------------------------------------------------------------------

/**
 * A rich card with arbitrary structured data.
 * Rendering is delegated to the platform (e.g. Slack block kit, Teams card).
 */
export type NcpCardPart = {
  type: "card";
  payload: Record<string, unknown>;
};

/** Formatted text with an explicit markup format hint. */
export type NcpRichTextPart = {
  type: "rich-text";
  format: "markdown" | "html" | "plain";
  text: string;
};

/**
 * An interactive action button or trigger exposed to the user.
 * The platform is responsible for rendering and routing the action.
 */
export type NcpActionPart = {
  type: "action";
  actionId: string;
  /** Display label shown to the user. */
  label: string;
  /** Arbitrary data forwarded to the action handler. */
  payload?: unknown;
};

// ---------------------------------------------------------------------------
// Open extension slot
// ---------------------------------------------------------------------------

/**
 * Escape hatch for custom or future part types not yet in the NCP spec.
 *
 * Use this to avoid forking the protocol during early iterations.
 * Once a part type stabilizes, promote it to a first-class `NcpXxxPart`.
 */
export type NcpExtensionPart = {
  type: "extension";
  /** Namespaced identifier for the custom part (e.g. `"myapp.highlight"`). */
  extensionType: string;
  data: unknown;
};

// ---------------------------------------------------------------------------
// Unified part union
// ---------------------------------------------------------------------------

/** Union of all recognized NCP message part types. */
export type NcpMessagePart =
  | NcpTextPart
  | NcpFilePart
  | NcpSourcePart
  | NcpStepStartPart
  | NcpReasoningPart
  | NcpToolInvocationPart
  | NcpCardPart
  | NcpRichTextPart
  | NcpActionPart
  | NcpExtensionPart;

// ---------------------------------------------------------------------------
// Message envelope
// ---------------------------------------------------------------------------

/**
 * Canonical message envelope exchanged and persisted in NCP.
 *
 * A message is composed of an ordered list of typed `parts`, allowing
 * heterogeneous content (text, files, tool calls, etc.) in a single message.
 */
export type NcpMessage = {
  /** Globally unique message identifier. */
  id: string;
  /** The session this message belongs to. */
  sessionId: string;
  role: NcpMessageRole;
  status: NcpMessageStatus;
  parts: NcpMessagePart[];
  /** ISO 8601 timestamp (e.g. `"2024-01-15T10:30:00.000Z"`). */
  timestamp: string;
  /** Arbitrary transport- or application-level metadata. */
  metadata?: Record<string, unknown>;
};
