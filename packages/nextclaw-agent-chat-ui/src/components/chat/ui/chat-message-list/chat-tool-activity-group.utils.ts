import type {
  ChatMessagePartViewModel,
  ChatToolPartViewModel,
} from "@agent-chat-ui/components/chat/view-models/chat-ui.types";

export type ChatToolActivityFamily =
  | "read"
  | "edit"
  | "directory"
  | "search"
  | "bash"
  | "web"
  | "agent"
  | "panel"
  | "other";

export type ChatToolActivityTone = "success" | "error" | "cancelled" | "running";

type ChatToolCardPart = Extract<ChatMessagePartViewModel, { type: "tool-card" }>;
type ChatToolGroupPart = Extract<ChatMessagePartViewModel, { type: "tool-card" | "reasoning" }>;

export type ChatToolActivitySegment = {
  family: ChatToolActivityFamily;
  count: number;
  tone: ChatToolActivityTone;
};

type ActivityAccumulator = { units: Set<string>; tone: ChatToolActivityTone };

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

function isGroupableToolPart(part: ChatMessagePartViewModel | undefined): part is ChatToolGroupPart {
  return part?.type === "reasoning" || (part?.type === "tool-card" && !part.card.panelApp);
}

export function resolveToolActivityFamily(toolName: string): ChatToolActivityFamily {
  const lowered = toolName.toLowerCase();
  if (lowered === "list_dir") {
    return "directory";
  }
  if (lowered.includes("show_content") || lowered.includes("panel_app") || lowered.includes("panel")) {
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

function resolveActivityUnitKeys(
  card: ChatToolPartViewModel,
  family: ChatToolActivityFamily,
  callIndex: number,
): string[] {
  if (family !== "read" && family !== "edit" && family !== "directory") {
    return [`call:${callIndex}`];
  }
  const paths = card.fileOperation?.blocks.map(({ path }) => path.trim()).filter(Boolean);
  const summary = card.summary?.replace(/^(path|file):\s*/i, "").trim();
  return paths?.length ? paths : [summary || `call:${callIndex}`];
}

/**
 * Natural category+count phrases only.
 * Examples: `Read 3 files`, `运行 2 条命令`, `搜索 2 次`.
 * No command/path payload.
 */
function formatSegment(segment: ChatToolActivitySegment, labels: ChatToolActivityGroupLabels): string {
  const template = labels.segmentTemplates[segment.family];
  const body = segment.count === 1 ? template.one : template.other.split("{count}").join(String(segment.count));

  if (segment.tone === "error") {
    return `${body} ${labels.failedLabel}`;
  }
  if (segment.tone === "cancelled") {
    return `${body} ${labels.cancelledLabel}`;
  }
  return body;
}

export function buildToolActivitySegments(cards: ChatToolPartViewModel[]): ChatToolActivitySegment[] {
  const order: ChatToolActivityFamily[] = [];
  const byFamily = new Map<ChatToolActivityFamily, ActivityAccumulator>();

  for (const [callIndex, card] of cards.entries()) {
    const family = resolveToolActivityFamily(card.toolName);
    const unitKeys = resolveActivityUnitKeys(card, family, callIndex);
    const existing = byFamily.get(family);
    if (!existing) {
      order.push(family);
      byFamily.set(family, {
        units: new Set(unitKeys),
        tone: card.statusTone,
      });
      continue;
    }
    unitKeys.forEach((unitKey) => existing.units.add(unitKey));
    if (toneRank(card.statusTone) < toneRank(existing.tone)) {
      existing.tone = card.statusTone;
    }
  }

  const segments = order.map((family) => {
    const entry = byFamily.get(family)!;
    return {
      family,
      count: entry.units.size,
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

function collectToolGroupParts(
  parts: ChatMessagePartViewModel[],
  startIndex: number,
): {
  candidateParts: ChatToolGroupPart[];
  lastToolOffset: number;
} {
  const candidateParts: ChatToolGroupPart[] = [];
  let index = startIndex;
  let lastToolOffset = -1;
  while (true) {
    const candidate = parts[index];
    if (!isGroupableToolPart(candidate)) {
      break;
    }
    candidateParts.push(candidate);
    if (candidate.type === "tool-card") {
      lastToolOffset = candidateParts.length - 1;
    }
    index += 1;
  }
  return { candidateParts, lastToolOffset };
}

/** Groups tool cards across reasoning; content and interactive panel apps remain stable boundaries. */
export function groupConsecutiveToolParts(
  parts: ChatMessagePartViewModel[],
  labels: ChatToolActivityGroupLabels,
): ChatMessageRenderBlock[] {
  const blocks: ChatMessageRenderBlock[] = [];
  let index = 0;

  while (index < parts.length) {
    const part = parts[index]!;
    if (part.type !== "tool-card" || part.card.panelApp) {
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
    const { candidateParts, lastToolOffset } = collectToolGroupParts(parts, startIndex);

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
      key: `tool-group-${startIndex}`,
      group: {
        key: `tool-group-${startIndex}`,
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
