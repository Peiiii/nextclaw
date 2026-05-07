import type { InboundMessage, OutboundMessage } from "./events.js";

export const NEXTCLAW_CONTROL_METADATA_KEY = "__nextclaw_control";

type TypingStopControl = {
  type: "typing";
  action: "stop";
};

type AssistantStreamResetControl = {
  type: "assistant_stream";
  action: "reset";
};

type AssistantStreamDeltaControl = {
  type: "assistant_stream";
  action: "delta";
  delta: string;
};

type NextclawControl =
  | TypingStopControl
  | AssistantStreamResetControl
  | AssistantStreamDeltaControl;

function readControl(metadata: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }
  const raw = metadata[NEXTCLAW_CONTROL_METADATA_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  return raw as Record<string, unknown>;
}

function readTypingStopControl(metadata: Record<string, unknown> | undefined): TypingStopControl | null {
  const control = readControl(metadata);
  if (!control) {
    return null;
  }
  if (control.type !== "typing") {
    return null;
  }
  if (control.action !== "stop") {
    return null;
  }
  return {
    type: "typing",
    action: "stop"
  };
}

function readAssistantStreamResetControl(
  metadata: Record<string, unknown> | undefined
): AssistantStreamResetControl | null {
  const control = readControl(metadata);
  if (!control) {
    return null;
  }
  if (control.type !== "assistant_stream") {
    return null;
  }
  if (control.action !== "reset") {
    return null;
  }
  return {
    type: "assistant_stream",
    action: "reset"
  };
}

function readAssistantStreamDeltaControl(
  metadata: Record<string, unknown> | undefined
): AssistantStreamDeltaControl | null {
  const control = readControl(metadata);
  if (!control) {
    return null;
  }
  if (control.type !== "assistant_stream") {
    return null;
  }
  if (control.action !== "delta") {
    return null;
  }
  const delta = typeof control.delta === "string" ? control.delta : "";
  if (!delta) {
    return null;
  }
  return {
    type: "assistant_stream",
    action: "delta",
    delta
  };
}

export function readNextclawControl(metadata: Record<string, unknown> | undefined): NextclawControl | null {
  return (
    readTypingStopControl(metadata) ??
    readAssistantStreamResetControl(metadata) ??
    readAssistantStreamDeltaControl(metadata)
  );
}

export function isNextclawControlMessage(msg: Pick<OutboundMessage, "metadata">): boolean {
  return readNextclawControl(msg.metadata) !== null;
}

export function isTypingStopControlMessage(msg: Pick<OutboundMessage, "metadata">): boolean {
  return readTypingStopControl(msg.metadata) !== null;
}

export function isAssistantStreamResetControlMessage(msg: Pick<OutboundMessage, "metadata">): boolean {
  return readAssistantStreamResetControl(msg.metadata) !== null;
}

export function readAssistantStreamDelta(msg: Pick<OutboundMessage, "metadata">): string | null {
  return readAssistantStreamDeltaControl(msg.metadata)?.delta ?? null;
}

export function createTypingStopControlMessage(msg: InboundMessage): OutboundMessage {
  return {
    channel: msg.channel,
    chatId: msg.chatId,
    content: "",
    media: [],
    metadata: {
      ...(msg.metadata ?? {}),
      [NEXTCLAW_CONTROL_METADATA_KEY]: {
        type: "typing",
        action: "stop"
      }
    }
  };
}

export function createAssistantStreamResetControlMessage(msg: InboundMessage): OutboundMessage {
  return {
    channel: msg.channel,
    chatId: msg.chatId,
    content: "",
    media: [],
    metadata: {
      ...(msg.metadata ?? {}),
      [NEXTCLAW_CONTROL_METADATA_KEY]: {
        type: "assistant_stream",
        action: "reset"
      }
    }
  };
}

export function createAssistantStreamDeltaControlMessage(msg: InboundMessage, delta: string): OutboundMessage {
  return {
    channel: msg.channel,
    chatId: msg.chatId,
    content: "",
    media: [],
    metadata: {
      ...(msg.metadata ?? {}),
      [NEXTCLAW_CONTROL_METADATA_KEY]: {
        type: "assistant_stream",
        action: "delta",
        delta
      }
    }
  };
}
