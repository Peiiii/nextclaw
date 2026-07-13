import type { ReactNode } from "react";
import { useChatMessageLayoutStore } from "@/features/chat/stores/chat-message-layout.store";
import { cn } from "@/shared/lib/utils";

type ChatConversationTrackProps = {
  children: ReactNode;
  className?: string;
  width?: "messages" | "composer";
};

export function ChatConversationTrack({
  children,
  className,
  width = "messages",
}: ChatConversationTrackProps) {
  const layout = useChatMessageLayoutStore((state) => state.layout);

  return (
    <div
      data-chat-conversation-track={layout}
      data-chat-conversation-track-width={width}
      className={cn(
        "mx-auto w-full px-4 sm:px-6",
        layout === "flat"
          ? width === "composer"
            ? "max-w-[min(54rem,100%)]"
            : "max-w-[min(52rem,100%)]"
          : "max-w-[min(1120px,100%)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
