import type {
  ChatMessagePartViewModel,
  ChatMessageTexts,
} from "@agent-chat-ui/components/chat/view-models/chat-ui.types";
import { ChatMessageFile } from "./index";
import type { ChatMessageImageGroupBlock } from "./chat-message-image-group.utils";

type ChatMessageImageRowProps = {
  group: ChatMessageImageGroupBlock;
  indexOffset: number;
  isUser: boolean;
  texts: Pick<
    ChatMessageTexts,
    | "attachmentOpenLabel"
    | "attachmentAttachedLabel"
    | "attachmentExpandLabel"
    | "attachmentCloseLabel"
    | "attachmentCategoryLabels"
  >;
  onOpen?: (
    file: Extract<ChatMessagePartViewModel, { type: "file" }>["file"],
  ) => void;
};

export function ChatMessageImageRow({
  group,
  indexOffset,
  isUser,
  texts,
  onOpen,
}: ChatMessageImageRowProps) {
  return (
    <div
      data-chat-message-image-row="three-column"
      data-chat-message-wide-content="true"
      className="grid w-full grid-cols-3 items-start gap-3"
    >
      {group.items.map(({ index, part }) => (
        <ChatMessageFile
          key={`file-${indexOffset + index}`}
          file={part.file}
          isUser={isUser}
          texts={texts}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
