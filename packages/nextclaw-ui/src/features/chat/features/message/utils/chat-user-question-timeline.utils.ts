import type { NcpMessage } from "@nextclaw/ncp";

function questionIdsFromToolPart(part: NcpMessage["parts"][number]): string[] {
  if (part.type !== "tool-invocation" || part.toolName !== "request_user_input_async" ||
    !part.result || typeof part.result !== "object" || Array.isArray(part.result)) return [];
  const { accepted, questionIds } = part.result as { accepted?: unknown; questionIds?: unknown };
  return accepted === true && Array.isArray(questionIds) && questionIds.every((id) => typeof id === "string")
    ? questionIds : [];
}

function questionEntries(part: NcpMessage["parts"][number]): Array<{ id: string }> {
  if (part.type !== "extension" || part.extensionType !== "nextclaw.user-question") return [];
  const entries = part.data && typeof part.data === "object" && "questions" in part.data ? part.data.questions : null;
  return Array.isArray(entries) ? entries.filter((entry): entry is { id: string } => Boolean(entry && typeof entry.id === "string")) : [];
}

export function placeUserQuestionsInAssistantBody<T extends { boundaryIndex: number }>(
  messages: NcpMessage[], observationEvents: T[],
): { messages: NcpMessage[]; observationEvents: T[] } {
  const entriesById = new Map(messages.flatMap((message) => message.parts.flatMap((part) => questionEntries(part).map((entry) => [entry.id, entry] as const))));
  const anchoredIds = new Set(messages.flatMap((message) => message.parts.flatMap((part) =>
    questionIdsFromToolPart(part).filter((id) => entriesById.has(id)))));
  if (!anchoredIds.size) return { messages, observationEvents };
  const removedIndices: number[] = [];
  const projected = messages.flatMap((message, index) => {
    const questionPart = message.parts.find((part) => questionEntries(part).length);
    if (questionPart && message.id.startsWith("assistant-question-")) {
      const remaining = questionEntries(questionPart).filter((entry) => !anchoredIds.has(entry.id));
      if (!remaining.length) { removedIndices.push(index); return []; }
      return [{ ...message, parts: [{ type: "extension" as const, extensionType: "nextclaw.user-question", data: { questions: remaining } }] }];
    }
    const parts = message.parts.flatMap((part): NcpMessage["parts"] => {
      const questions = questionIdsFromToolPart(part).flatMap((id) => entriesById.get(id) ?? []);
      return questions.length
        ? [{ type: "extension", extensionType: "nextclaw.user-question", data: { questions } }]
        : [part];
    });
    return [{ ...message, parts }];
  });
  return { messages: projected, observationEvents: observationEvents.map((entry) => ({ ...entry,
    boundaryIndex: entry.boundaryIndex - removedIndices.filter((index) => index < entry.boundaryIndex).length })) };
}
