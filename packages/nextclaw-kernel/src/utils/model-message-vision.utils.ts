const IMAGE_OMITTED_TEXT = "[Image omitted: the selected model is not configured for vision input.]";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isImageContentPart(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const type = value.type;
  return type === "image_url" || type === "input_image";
}

function normalizeContentWithoutVision(content: unknown): unknown {
  if (!Array.isArray(content)) {
    return content;
  }

  let sawImage = false;
  const parts = content.map((part) => {
    if (!isImageContentPart(part)) {
      return part;
    }
    sawImage = true;
    return { type: "text", text: IMAGE_OMITTED_TEXT };
  });

  if (!sawImage) {
    return content;
  }

  const textParts = parts
    .filter((part): part is { type: "text"; text: string } => (
      isRecord(part) && part.type === "text" && typeof part.text === "string"
    ))
    .map((part) => part.text.trim())
    .filter(Boolean);
  if (textParts.length === parts.length) {
    return textParts.join("\n\n");
  }
  return parts;
}

export function normalizeModelMessagesForVisionSupport(params: {
  messages: Array<Record<string, unknown>>;
  supportsVision: boolean;
}): Array<Record<string, unknown>> {
  if (params.supportsVision) {
    return params.messages;
  }
  return params.messages.map((message) => {
    if (!Object.prototype.hasOwnProperty.call(message, "content")) {
      return message;
    }
    const content = normalizeContentWithoutVision(message.content);
    return content === message.content ? message : { ...message, content };
  });
}
