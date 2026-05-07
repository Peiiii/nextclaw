import type { InboundMessage } from "../../bus/events.js";
import type { Tool } from "../tools/base.js";
import type { ToolRegistry } from "../tools/registry.js";

export async function prepareInboundMessageWithAttachments(params: {
  message: InboundMessage;
  prepareInboundAttachments?:
    | ((
        attachments: InboundMessage["attachments"],
      ) => Promise<InboundMessage["attachments"]> | InboundMessage["attachments"])
    | undefined;
}): Promise<InboundMessage> {
  const { message, prepareInboundAttachments } = params;
  if (!prepareInboundAttachments || message.attachments.length === 0) {
    return message;
  }

  return {
    ...message,
    attachments: await prepareInboundAttachments(
      message.attachments.map((attachment) => ({ ...attachment })),
    ),
  };
}

export function registerRuntimeTools(params: {
  registry: ToolRegistry;
  additionalTools?: Tool[];
}): void {
  for (const tool of params.additionalTools ?? []) {
    params.registry.register(tool);
  }
}
