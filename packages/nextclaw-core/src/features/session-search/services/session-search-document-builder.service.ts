import type {
  SessionSearchDocument,
  SessionSearchSessionRecord,
} from "@core/features/session-search/types/session-search.types.js";

const AUTO_LABEL_MAX_LENGTH = 64;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function truncateLabel(value: string): string {
  const characters = Array.from(value);
  if (characters.length <= AUTO_LABEL_MAX_LENGTH) {
    return value;
  }
  return `${characters.slice(0, AUTO_LABEL_MAX_LENGTH).join("")}...`;
}

const normalizeString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

export class SessionSearchDocumentBuilderService {
  buildDocument = (session: SessionSearchSessionRecord): SessionSearchDocument | null => {
    const label = this.resolveSessionLabel(session);
    const content = this.buildSearchableContent(session);
    if (!label && !content) {
      return null;
    }

    return {
      sessionId: session.sessionId,
      label,
      content,
      updatedAt: session.updatedAt,
    };
  };

  private resolveSessionLabel = (session: SessionSearchSessionRecord): string => {
    const metadataLabel =
      normalizeString(session.metadata?.label) ??
      normalizeString(session.metadata?.session_label);
    if (metadataLabel) {
      return metadataLabel;
    }

    for (const message of session.messages) {
      if (message.role !== "user") {
        continue;
      }
      const text = normalizeString(message.content);
      if (text) {
        return truncateLabel(text);
      }
    }

    return "";
  };

  private buildSearchableContent = (session: SessionSearchSessionRecord): string => {
    const lines: string[] = [];
    for (const message of session.messages) {
      if (message.role !== "user" && message.role !== "assistant") {
        continue;
      }
      const text = normalizeString(message.content);
      if (!text) {
        continue;
      }
      lines.push(`${message.role}: ${normalizeWhitespace(text)}`);
    }
    return lines.join("\n");
  };
}
