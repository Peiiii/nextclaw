import type { InboundMessage, OutboundMessage } from "./events.js";

export const NEXTCLAW_CONTROL_METADATA_KEY = "__nextclaw_control";

type TypingStopControl = {
  type: "typing";
  action: "stop";
};

function readTypingStopControl(metadata: Record<string, unknown> | undefined): TypingStopControl | null {
  if (!metadata) {
    return null;
  }
  const raw = metadata[NEXTCLAW_CONTROL_METADATA_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const control = raw as Record<string, unknown>;
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

export function isTypingStopControlMessage(msg: Pick<OutboundMessage, "metadata">): boolean {
  return readTypingStopControl(msg.metadata) !== null;
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
