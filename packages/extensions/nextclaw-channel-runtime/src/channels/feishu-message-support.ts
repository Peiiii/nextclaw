const TABLE_RE = /((?:^[ \t]*\|.+\|[ \t]*\n)(?:^[ \t]*\|[-:\s|]+\|[ \t]*\n)(?:^[ \t]*\|.+\|[ \t]*\n?)+)/gm;

export function extractSenderInfo(sender: Record<string, unknown>): {
  senderId: string;
  senderType?: string;
  senderOpenId?: string;
  senderUserId?: string;
  senderUnionId?: string;
} {
  const senderIdObj = (sender.sender_id as Record<string, unknown> | undefined) ?? {};
  const senderOpenId =
    (senderIdObj.open_id as string | undefined) || (sender.open_id as string | undefined) || "";
  const senderUserId =
    (senderIdObj.user_id as string | undefined) || (sender.user_id as string | undefined) || "";
  const senderUnionId =
    (senderIdObj.union_id as string | undefined) || (sender.union_id as string | undefined) || "";
  return {
    senderId: senderOpenId || senderUserId || senderUnionId || "",
    senderType: (sender.sender_type as string | undefined) ?? (sender.senderType as string | undefined),
    senderOpenId: senderOpenId || undefined,
    senderUserId: senderUserId || undefined,
    senderUnionId: senderUnionId || undefined
  };
}

export function extractMessageInfo(message: Record<string, unknown>): {
  chatId: string;
  chatType: string;
  isGroup: boolean;
  msgType: string;
  messageId: string;
  rawContent: string;
} {
  const chatId = (message.chat_id as string | undefined) ?? "";
  const chatType = (message.chat_type as string | undefined) ?? "";
  return {
    chatId,
    chatType,
    isGroup: chatType === "group",
    msgType: (message.msg_type as string | undefined) ?? (message.message_type as string | undefined) ?? "",
    messageId: (message.message_id as string | undefined) ?? "",
    rawContent: typeof message.content === "string" ? message.content : ""
  };
}

export function extractMentions(root: Record<string, unknown>, message: Record<string, unknown>): unknown[] {
  if (Array.isArray(root.mentions)) {
    return root.mentions;
  }
  if (Array.isArray(message.mentions)) {
    return message.mentions;
  }
  return [];
}

export function buildInboundMetadata(params: {
  accountId: string;
  messageInfo: {
    chatId: string;
    chatType: string;
    isGroup: boolean;
    msgType: string;
    messageId: string;
  };
  senderInfo: {
    senderId: string;
    senderOpenId?: string;
    senderUserId?: string;
    senderUnionId?: string;
  };
  mentionState: { wasMentioned: boolean; requireMention: boolean };
}): Record<string, unknown> {
  return {
    account_id: params.accountId,
    accountId: params.accountId,
    message_id: params.messageInfo.messageId,
    chat_id: params.messageInfo.chatId,
    chat_type: params.messageInfo.chatType,
    msg_type: params.messageInfo.msgType,
    is_group: params.messageInfo.isGroup,
    peer_kind: params.messageInfo.isGroup ? "group" : "direct",
    peer_id: params.messageInfo.isGroup ? params.messageInfo.chatId : params.senderInfo.senderId,
    sender_open_id: params.senderInfo.senderOpenId,
    sender_user_id: params.senderInfo.senderUserId,
    sender_union_id: params.senderInfo.senderUnionId,
    was_mentioned: params.mentionState.wasMentioned,
    require_mention: params.mentionState.requireMention
  };
}

export function inferFeishuResourceMimeType(resourceType: "audio" | "file" | "image" | "sticker"): string | undefined {
  if (resourceType === "image" || resourceType === "sticker") {
    return "image/*";
  }
  if (resourceType === "audio") {
    return "audio/*";
  }
  return undefined;
}

export function buildFeishuCardElements(content: string): Array<Record<string, unknown>> {
  const elements: Array<Record<string, unknown>> = [];
  let lastEnd = 0;
  for (const match of content.matchAll(TABLE_RE)) {
    const start = match.index ?? 0;
    const tableText = match[1] ?? "";
    const before = content.slice(lastEnd, start).trim();
    if (before) {
      elements.push({ tag: "markdown", content: before });
    }
    elements.push(parseMarkdownTable(tableText) ?? { tag: "markdown", content: tableText });
    lastEnd = start + tableText.length;
  }
  const remaining = content.slice(lastEnd).trim();
  if (remaining) {
    elements.push({ tag: "markdown", content: remaining });
  }
  if (!elements.length) {
    elements.push({ tag: "markdown", content });
  }
  return elements;
}

function parseMarkdownTable(tableText: string): Record<string, unknown> | null {
  const lines = tableText
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 3) {
    return null;
  }
  const split = (line: string) => line.replace(/^\|+|\|+$/g, "").split("|").map((item) => item.trim());
  const headers = split(lines[0]);
  const rows = lines.slice(2).map(split);
  return {
    tag: "table",
    page_size: rows.length + 1,
    columns: headers.map((header, index) => ({
      tag: "column",
      name: `c${index}`,
      display_name: header,
      width: "auto"
    })),
    rows: rows.map((row) => {
      const values: Record<string, string> = {};
      headers.forEach((_, index) => {
        values[`c${index}`] = row[index] ?? "";
      });
      return values;
    })
  };
}
