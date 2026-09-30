import { biboCopy } from "@/shared/configs/bibo-copy.config";

export type StreamingBlock = { id: string; text: string };
export function appendStreamingBlock(blocks: StreamingBlock[], text: string, blockId = "answer"): StreamingBlock[] {
  if (!text) return blocks;
  const last = blocks.at(-1);
  return last?.id === blockId
    ? [...blocks.slice(0, -1), { id: blockId, text: last.text + text }]
    : [...blocks, { id: blockId, text }];
}

export function messageTime(at: string, previous?: string, now = new Date()): string | null {
  const date = new Date(at);
  if (!at || !Number.isFinite(date.getTime())) return null;
  const prior = previous ? new Date(previous) : null;
  if (prior && date.toDateString() === prior.toDateString() && date.getTime() - prior.getTime() < 300_000) return null;
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const day = date.toDateString() === now.toDateString() ? biboCopy.today
    : date.toDateString() === yesterday.toDateString() ? biboCopy.yesterday
    : date.toLocaleDateString("zh-CN", { ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" as const } : {}), month: "long", day: "numeric" });
  return `${day} ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}
