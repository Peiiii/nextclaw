import { readFileSync } from "node:fs";
import { extname } from "node:path";
import type { InboundAttachment } from "../../bus/events.js";

export type UserContentMessage = Record<string, unknown>;
export type ContextUserContent = string | UserContentMessage[];
export type ContextUserContentBuilder = (params: {
  text: string;
  attachments: InboundAttachment[];
}) => ContextUserContent;

export class DefaultUserContentBuilder {
  build = (params: { text: string; attachments: InboundAttachment[] }): ContextUserContent => {
    const { text, attachments } = params;
    if (!attachments.length) {
      return text;
    }

    const images: UserContentMessage[] = [];
    for (const attachment of attachments) {
      const mime = attachment.mimeType ?? this.guessImageMime(attachment.path ?? attachment.url ?? "");
      if (!mime || !mime.startsWith("image/")) {
        continue;
      }

      const imageContent = this.buildImageContent(attachment, mime);
      if (imageContent) {
        images.push(imageContent);
      }
    }

    if (!images.length) {
      return text;
    }
    return [...images, { type: "text", text }];
  };

  private buildImageContent = (
    attachment: InboundAttachment,
    mimeType: string,
  ): UserContentMessage | null => {
    const dataUrl = this.buildLocalDataUrl(attachment.path, mimeType);
    if (dataUrl) {
      return { type: "image_url", image_url: { url: dataUrl } };
    }

    if (attachment.url) {
      return { type: "image_url", image_url: { url: attachment.url } };
    }

    return null;
  };

  private buildLocalDataUrl = (path: string | undefined, mimeType: string): string | null => {
    if (!path) {
      return null;
    }

    try {
      return `data:${mimeType};base64,${readFileSync(path).toString("base64")}`;
    } catch {
      return null;
    }
  };

  private guessImageMime = (pathOrUrl: string): string | null => {
    const ext = extname(pathOrUrl).toLowerCase();
    if (ext === ".png") return "image/png";
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    if (ext === ".gif") return "image/gif";
    if (ext === ".webp") return "image/webp";
    if (ext === ".bmp") return "image/bmp";
    if (ext === ".tif" || ext === ".tiff") return "image/tiff";
    return null;
  };
}

export function buildDefaultUserContent(
  text: string,
  attachments: InboundAttachment[],
): ContextUserContent {
  return new DefaultUserContentBuilder().build({ text, attachments });
}
