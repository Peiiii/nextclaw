import type { ChatMessagePartViewModel } from "@agent-chat-ui/components/chat/view-models/chat-ui.types";
import type { ChatMessageRenderBlock } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-tool-activity-group.utils";

type ChatMessageFilePart = Extract<
  ChatMessagePartViewModel,
  { type: "file" }
>;

type ChatMessageImagePartBlock = Extract<
  ChatMessageRenderBlock,
  { kind: "part" }
> & { part: ChatMessageFilePart };

export type ChatMessageImageGroupBlock = {
  kind: "image-group";
  key: string;
  items: ChatMessageImagePartBlock[];
};

export type ChatMessageContentBlock =
  | ChatMessageRenderBlock
  | ChatMessageImageGroupBlock;

function isPreviewableImageBlock(
  block: ChatMessageRenderBlock | undefined,
): block is ChatMessageImagePartBlock {
  return Boolean(
    block?.kind === "part" &&
      block.part.type === "file" &&
      block.part.file.isImage &&
      block.part.file.dataUrl,
  );
}

export function groupConsecutiveImageFileBlocks(
  blocks: ChatMessageRenderBlock[],
): ChatMessageContentBlock[] {
  const grouped: ChatMessageContentBlock[] = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index];
    if (!isPreviewableImageBlock(block)) {
      if (block) grouped.push(block);
      index += 1;
      continue;
    }

    const startIndex = index;
    const items: ChatMessageImagePartBlock[] = [];
    while (isPreviewableImageBlock(blocks[index])) {
      items.push(blocks[index] as ChatMessageImagePartBlock);
      index += 1;
    }

    if (items.length < 3) {
      grouped.push(...items);
      continue;
    }
    grouped.push({
      kind: "image-group",
      key: `image-group-${startIndex}`,
      items,
    });
  }

  return grouped;
}
