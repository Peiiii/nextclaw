import type {
  ChatMessagePartViewModel,
  ChatToolPartViewModel,
} from "@agent-chat-ui/components/chat/view-models/chat-ui.types";

export type ChatToolActivityFamily =
  | "read"
  | "edit"
  | "search"
  | "bash"
  | "web"
  | "agent"
  | "panel"
  | "other";

export type ChatToolActivityTone = "success" | "error" | "cancelled" | "running";

type ChatToolCardPart = Extract<ChatMessagePartViewModel, { type: "tool-card" }>;
type ChatToolGroupPart = Extract<
  ChatMessagePartViewModel,
  { type: "tool-card" | "reasoning" }
>;

export type ChatToolActivitySegment = {
  family: ChatToolActivityFamily;
  count: number;
  tone: ChatToolActivityTone;
};

export type ChatToolActivityGroupViewModel = {
  key: string;
  startIndex: number;
  endIndex: number;
  parts: ChatToolGroupPart[];
  segments: ChatToolActivitySegment[];
  label: string;
};

export type ChatToolActivityGroupLabels = {
  /** Full natural phrases. `one` is singular; `other` uses `{count}`. */
  segmentTemplates: Record<
    ChatToolActivityFamily,
    {
      one: string;
      other: string;
    }
  >;
  failedLabel: string;
  cancelledLabel: string;
};

export type ChatMessageRenderBlock =
  | {
      kind: "part";
      key: string;
      index: number;
      part: ChatMessagePartViewModel;
    }
  | {
      kind: "tool-group";
      key: string;
      group: ChatToolActivityGroupViewModel;
    };

const MAX_SUMMARY_SEGMENTS = 3;

function isToolCardPart(part: ChatToolGroupPart): part is ChatToolCardPart {
  return part.type === "tool-card";
}

export function resolveToolActivityFamily(toolName: string): ChatToolActivityFamily {
  const lowered = toolName.toLowerCase();
  if (
    lowered.includes("show_content") ||
    lowered.includes("panel_app") ||
    lowered.includes("panel")
  ) {
    return "panel";
  }
  if (
    lowered === "spawn" ||
    lowered.includes("subagent") ||
    lowered.includes("session_request") ||
    (lowered.includes("agent") && !lowered.includes("read"))
  ) {
    return "agent";
  }
  if (
    lowered.includes("web_") ||
    lowered.includes("_web") ||
    lowered.includes("url") ||
    lowered.includes("fetch") ||
    lowered.includes("http")
  ) {
    return "web";
  }
  if (
    lowered === "grep_search" ||
    lowered === "find_files" ||
    lowered === "search_files" ||
    lowered.includes("search") ||
    lowered.includes("grep")
  ) {
    return "search";
  }
  if (
    lowered === "exec" ||
    lowered === "exec_command" ||
    lowered === "execute_command" ||
    lowered === "command_execution" ||
    lowered === "bash" ||
    lowered === "shell" ||
    lowered === "terminal" ||
    lowered.includes("run_")
  ) {
    return "bash";
  }
  if (
    lowered === "write_file" ||
    lowered === "edit_file" ||
    lowered === "apply_patch" ||
    lowered === "file_change" ||
    lowered === "multi_replace" ||
    lowered.includes("write_file") ||
    lowered.includes("edit_file") ||
    lowered.includes("apply_patch")
  ) {
    return "edit";
  }
  if (
    lowered === "read_file" ||
    lowered === "read" ||
    lowered === "view_file" ||
    lowered.includes("read_file") ||
    lowered.startsWith("read_")
  ) {
    return "read";
  }
  return "other";
}

function toneRank(tone: ChatToolActivityTone): number {
  if (tone === "error") return 0;
  if (tone === "cancelled") return 1;
  if (tone === "running") return 2;
  return 3;
}

function mergeTone(
  current: ChatToolActivityTone,
  next: ChatToolActivityTone,
): ChatToolActivityTone {
  return toneRank(next) < toneRank(current) ? next : current;
}

/**
 * Natural category+count phrases only.
 * Examples: `Read 3 files`, `运行 2 条命令`, `搜索 2 次`.
 * No command/path payload.
 */
function formatSegment(
  segment: ChatToolActivitySegment,
  labels: ChatToolActivityGroupLabels,
): string {
  const template = labels.segmentTemplates[segment.family];
  const body =
    segment.count === 1
      ? template.one
      : template.other.split("{count}").join(String(segment.count));

  if (segment.tone === "error") {
    return `${body} ${labels.failedLabel}`;
  }
  if (segment.tone === "cancelled") {
    return `${body} ${labels.cancelledLabel}`;
  }
  return body;
}

export function buildToolActivitySegments(
  cards: ChatToolPartViewModel[],
): ChatToolActivitySegment[] {
  if (cards.length === 0) {
    return [];
  }

  const order: ChatToolActivityFamily[] = [];
  const byFamily = new Map<
    ChatToolActivityFamily,
    {
      count: number;
      tone: ChatToolActivityTone;
    }
  >();

  for (const card of cards) {
    const family = resolveToolActivityFamily(card.toolName);
    const existing = byFamily.get(family);
    if (!existing) {
      order.push(family);
      byFamily.set(family, {
        count: 1,
        tone: card.statusTone,
      });
      continue;
    }
    existing.count += 1;
    existing.tone = mergeTone(existing.tone, card.statusTone);
  }

  const segments = order.map((family) => {
    const entry = byFamily.get(family)!;
    return {
      family,
      count: entry.count,
      tone: entry.tone,
    } satisfies ChatToolActivitySegment;
  });

  segments.sort((left, right) => {
    const toneDelta = toneRank(left.tone) - toneRank(right.tone);
    if (toneDelta !== 0) {
      return toneDelta;
    }
    return order.indexOf(left.family) - order.indexOf(right.family);
  });

  return segments;
}

export function formatToolActivityGroupLabel(params: {
  segments: ChatToolActivitySegment[];
  labels: ChatToolActivityGroupLabels;
}): string {
  const { labels, segments } = params;
  if (segments.length === 0) {
    return "";
  }
  const visible = segments.slice(0, MAX_SUMMARY_SEGMENTS);
  const hiddenCount = segments.length - visible.length;
  const parts = visible.map((segment) => formatSegment(segment, labels));
  if (hiddenCount > 0) {
    parts.push(`+${hiddenCount}`);
  }
  return parts.join(" · ");
}

/**
 * Group tool cards separated only by reasoning into one visible workflow.
 * Markdown, files and unknown parts still break the run.
 * Single tool-cards stay ungrouped so they keep their native card UI.
 */
export function groupConsecutiveToolParts(
  parts: ChatMessagePartViewModel[],
  labels: ChatToolActivityGroupLabels,
): ChatMessageRenderBlock[] {
  const blocks: ChatMessageRenderBlock[] = [];
  let index = 0;

  while (index < parts.length) {
    const part = parts[index]!;
    if (part.type !== "tool-card") {
      blocks.push({
        kind: "part",
        key: `part-${index}`,
        index,
        part,
      });
      index += 1;
      continue;
    }

    const startIndex = index;
    const candidateParts: ChatToolGroupPart[] = [];
    let lastToolOffset = -1;
    while (
      index < parts.length &&
      (parts[index]?.type === "tool-card" || parts[index]?.type === "reasoning")
    ) {
      const candidate = parts[index] as ChatToolGroupPart;
      candidateParts.push(candidate);
      if (candidate.type === "tool-card") {
        lastToolOffset = candidateParts.length - 1;
      }
      index += 1;
    }

    const toolParts = candidateParts.filter(isToolCardPart);
    if (toolParts.length === 1) {
      blocks.push({
        kind: "part",
        key: `part-${startIndex}`,
        index: startIndex,
        part,
      });
      index = startIndex + 1;
      continue;
    }

    const groupedParts = candidateParts.slice(0, lastToolOffset + 1);
    index = startIndex + groupedParts.length;
    const cards = toolParts.map((toolPart) => toolPart.card);
    const segments = buildToolActivitySegments(cards);
    const label = formatToolActivityGroupLabel({ segments, labels });
    blocks.push({
      kind: "tool-group",
      key: `tool-group-${startIndex}-${index - 1}`,
      group: {
        key: `tool-group-${startIndex}-${index - 1}`,
        startIndex,
        endIndex: index - 1,
        parts: groupedParts,
        segments,
        label,
      },
    });
  }

  return blocks;
}
