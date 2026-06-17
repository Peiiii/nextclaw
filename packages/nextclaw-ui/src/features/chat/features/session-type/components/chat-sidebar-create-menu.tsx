import { ChatSessionTypeOptionItem } from "@/features/chat/features/session-type/components/chat-session-type-option-item";
import type { ChatInputSnapshot } from "@/features/chat/stores/chat-input.store";
import { createPopoverAvailableHeightLimit } from "@/shared/components/ui/popover";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

type SessionTypeOption = ChatInputSnapshot["sessionTypeOptions"][number];
const CHAT_SIDEBAR_CREATE_MENU_MAX_HEIGHT =
  createPopoverAvailableHeightLimit("18rem");
const CHAT_SIDEBAR_CREATE_MENU_STYLE = {
  maxHeight: CHAT_SIDEBAR_CREATE_MENU_MAX_HEIGHT,
};

type ChatSidebarCreateMenuProps = {
  options: readonly SessionTypeOption[];
  onSelect: (sessionType: string) => void;
  title?: string;
  className?: string;
  titleClassName?: string;
};

export function ChatSidebarCreateMenu({
  className,
  onSelect,
  options,
  title = t("chatSessionTypeLabel"),
  titleClassName,
}: ChatSidebarCreateMenuProps) {
  return (
    <div
      className={cn("space-y-1 overflow-y-auto overscroll-contain", className)}
      style={CHAT_SIDEBAR_CREATE_MENU_STYLE}
    >
      <div
        className={cn(
          "px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400",
          titleClassName,
        )}
      >
        {title}
      </div>
      {options.map((option) => (
        <ChatSessionTypeOptionItem
          key={option.value}
          option={option}
          onSelect={() => onSelect(option.value)}
        />
      ))}
    </div>
  );
}
