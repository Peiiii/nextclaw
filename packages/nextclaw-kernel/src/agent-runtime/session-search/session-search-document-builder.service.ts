import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { extractTextFromNcpMessage, normalizeString } from "@kernel/agent-runtime/nextclaw-ncp-message-bridge.utils.js";
import type { SessionSearchDocument } from "./session-search.types.js";

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

export class SessionSearchDocumentBuilderService {
  buildDocument = (session: AgentSessionRecord): SessionSearchDocument | null => {
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

  private resolveSessionLabel = (session: AgentSessionRecord): string => {
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
      const text = normalizeString(extractTextFromNcpMessage(message));
      if (text) {
        return truncateLabel(text);
      }
    }

    return "";
  };

  private buildSearchableContent = (session: AgentSessionRecord): string => {
    const lines: string[] = [];
    for (const message of session.messages) {
      if (message.role !== "user" && message.role !== "assistant") {
        continue;
      }
      const text = normalizeString(extractTextFromNcpMessage(message));
      if (!text) {
        continue;
      }
      lines.push(`${message.role}: ${normalizeWhitespace(text)}`);
    }
    return lines.join("\n");
  };
}
