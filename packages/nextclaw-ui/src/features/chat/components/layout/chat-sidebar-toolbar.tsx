import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { ChatSessionTypeOptionItem } from "@/features/chat/components/chat-session-type-option-item";
import type { ChatInputSnapshot } from "@/features/chat/stores/chat-input.store";
import { cn } from "@/shared/lib/utils";
import { t } from "@/shared/lib/i18n";
import { ChevronDown, Plus, Search } from "lucide-react";

type SessionTypeOption = ChatInputSnapshot["sessionTypeOptions"][number];

type ChatSidebarToolbarProps = {
  query: string;
  defaultSessionType: string;
  sessionTypeOptions: SessionTypeOption[];
  nonDefaultSessionTypeOptions: SessionTypeOption[];
  isCreateMenuOpen: boolean;
  onCreateMenuOpenChange: (open: boolean) => void;
  onCreateSession: (sessionType: string) => void;
  onQueryChange: (query: string) => void;
};

function getMobileCreateOptions(params: {
  defaultSessionType: string;
  sessionTypeOptions: SessionTypeOption[];
  nonDefaultSessionTypeOptions: SessionTypeOption[];
}): SessionTypeOption[] {
  const defaultOption = params.sessionTypeOptions.find(
    (option) => option.value === params.defaultSessionType,
  );
  return [
    ...(defaultOption ? [defaultOption] : []),
    ...params.nonDefaultSessionTypeOptions,
  ];
}

export function ChatSidebarDesktopToolbar(props: ChatSidebarToolbarProps) {
  const {
    query,
    defaultSessionType,
    nonDefaultSessionTypeOptions,
    isCreateMenuOpen,
    onCreateMenuOpenChange,
    onCreateSession,
    onQueryChange,
  } = props;

  return (
    <>
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            className={cn(
              "min-w-0 rounded-xl",
              nonDefaultSessionTypeOptions.length > 0
                ? "flex-1 rounded-r-md"
                : "w-full",
            )}
            onClick={() => {
              onCreateMenuOpenChange(false);
              onCreateSession(defaultSessionType);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("chatSidebarNewTask")}
          </Button>
          {nonDefaultSessionTypeOptions.length > 0 ? (
            <Popover
              open={isCreateMenuOpen}
              onOpenChange={onCreateMenuOpenChange}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="primary"
                  size="icon"
                  className="h-9 w-10 shrink-0 rounded-xl rounded-l-md"
                  aria-label={t("chatSessionTypeLabel")}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-56 rounded-2xl border border-gray-200/80 bg-white p-1.5 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.38)]"
              >
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                  {t("chatSessionTypeLabel")}
                </div>
                <div className="space-y-1">
                  {nonDefaultSessionTypeOptions.map((option) => (
                    <ChatSessionTypeOptionItem
                      key={option.value}
                      option={option}
                      onSelect={() => {
                        onCreateSession(option.value);
                        onCreateMenuOpenChange(false);
                      }}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t("chatSidebarSearchPlaceholder")}
            className="h-9 rounded-lg pl-8 text-xs"
          />
        </div>
      </div>
    </>
  );
}

export function ChatSidebarMobileToolbar(props: ChatSidebarToolbarProps) {
  const {
    query,
    defaultSessionType,
    sessionTypeOptions,
    nonDefaultSessionTypeOptions,
    isCreateMenuOpen,
    onCreateMenuOpenChange,
    onCreateSession,
    onQueryChange,
  } = props;
  const createOptions = getMobileCreateOptions({
    defaultSessionType,
    sessionTypeOptions,
    nonDefaultSessionTypeOptions,
  });
  const hasCreateMenu = createOptions.length > 1;

  return (
    <div className="px-4 pb-2 pt-1">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t("chatSidebarSearchPlaceholder")}
            className="h-9 rounded-full border-transparent bg-gray-100/80 pl-9 pr-3 text-[13px] shadow-none focus:border-gray-200/80 focus:bg-white"
          />
        </div>

        {hasCreateMenu ? (
          <Popover open={isCreateMenuOpen} onOpenChange={onCreateMenuOpenChange}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full bg-gray-100/80 text-gray-700 shadow-none hover:bg-gray-200/80 hover:text-gray-900"
                aria-label={t("chatSidebarNewTask")}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-60 rounded-3xl border border-gray-200/80 bg-white p-2 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.45)]"
            >
              <div className="px-3 pb-1.5 pt-2 text-[11px] font-medium text-gray-400">
                {t("chatSidebarNewTask")}
              </div>
              <div className="space-y-1">
                {createOptions.map((option) => (
                  <ChatSessionTypeOptionItem
                    key={option.value}
                    option={option}
                    onSelect={() => {
                      onCreateSession(option.value);
                      onCreateMenuOpenChange(false);
                    }}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full bg-gray-100/80 text-gray-700 shadow-none hover:bg-gray-200/80 hover:text-gray-900"
            aria-label={t("chatSidebarNewTask")}
            onClick={() => onCreateSession(defaultSessionType)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
