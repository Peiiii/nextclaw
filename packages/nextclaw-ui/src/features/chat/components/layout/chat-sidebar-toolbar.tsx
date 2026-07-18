import { Button, type ButtonProps } from "@/shared/components/ui/button";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
import { Input } from "@/shared/components/ui/input";
import {
  Popover,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { ChatPopoverContent } from "@/features/chat/components/chat-popover-content";
import { SessionContextIconNode } from "@/features/chat/features/session/components/session-context-icon";
import { ChatSessionTypeMenu } from "@/features/chat/features/session-type/components/chat-session-type-menu";
import type { ChatSessionTypeOption } from "@/features/chat/features/session-type/utils/chat-session-type.utils";
import { cn } from "@/shared/lib/utils";
import { t } from "@/shared/lib/i18n";
import { Bot, ChevronDown, Plus, Search } from "lucide-react";
import {
  SIDEBAR_RAIL_CONTROL_CLASS,
  SIDEBAR_RAIL_ICON_CLASS,
  SIDEBAR_RAIL_ITEM_GAP_CLASS,
  SIDEBAR_RAIL_SURFACE_CLASS,
} from "@/app/components/layout/sidebar-rail.styles";

type SessionTypeOption = ChatSessionTypeOption;
type NewSessionActionStyleVariant =
  | "neutralSurface"
  | "brandSoft"
  | "brandTextSurface"
  | "brandSolid";

const NEW_SESSION_ACTION_STYLE_VARIANT: NewSessionActionStyleVariant =
  "brandSoft";

const NEW_SESSION_ACTION_STYLE_CLASSES: Record<
  NewSessionActionStyleVariant,
  {
    leftVariant: ButtonProps["variant"];
    leftClassName: string;
    rightClassName: string;
  }
> = {
  neutralSurface: {
    leftVariant: "ghost",
    leftClassName:
      "bg-card text-foreground shadow-none transition-[background-color,color,box-shadow] hover:bg-accent hover:text-accent-foreground hover:shadow-sm active:bg-accent",
    rightClassName:
      "bg-card text-muted-foreground shadow-none transition-[background-color,color,box-shadow] hover:bg-accent hover:text-accent-foreground hover:shadow-sm active:bg-accent",
  },
  brandSoft: {
    leftVariant: "ghost",
    leftClassName:
      "bg-primary/10 text-primary shadow-none ring-1 ring-primary/10 transition-[background-color,color,box-shadow] hover:bg-primary/15 hover:text-primary-700 hover:shadow-sm active:bg-primary/20",
    rightClassName:
      "bg-primary/10 text-primary shadow-none ring-1 ring-primary/10 transition-[background-color,color,box-shadow] hover:bg-primary/15 hover:text-primary-700 hover:shadow-sm active:bg-primary/20",
  },
  brandTextSurface: {
    leftVariant: "ghost",
    leftClassName:
      "bg-card text-primary shadow-none transition-[background-color,color,box-shadow] hover:bg-accent hover:text-primary-700 hover:shadow-sm active:bg-primary/15",
    rightClassName:
      "bg-card text-primary shadow-none transition-[background-color,color,box-shadow] hover:bg-accent hover:text-primary-700 hover:shadow-sm active:bg-primary/15",
  },
  brandSolid: {
    leftVariant: "primary",
    leftClassName: "",
    rightClassName:
      "bg-primary text-primary-foreground shadow-sm hover:bg-primary-600 hover:text-primary-foreground active:bg-primary-700",
  },
};

type ChatSidebarToolbarProps = {
  query: string;
  defaultSessionType: string;
  sessionTypeOptions: SessionTypeOption[];
  selectedNewSessionType: string;
  selectedNewSessionTypeOption: SessionTypeOption | null;
  isCreateMenuOpen: boolean;
  onCreateMenuOpenChange: (open: boolean) => void;
  onCreateSession: (sessionType: string) => void;
  onSelectNewSessionType: (sessionType: string) => void;
  onQueryChange: (query: string) => void;
  collapsed?: boolean;
};

function SessionTypeTriggerIcon({
  option,
}: {
  option: SessionTypeOption | null;
}) {
  if (option?.icon?.src) {
    return (
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <SessionContextIconNode
          icon={{
            kind: "runtime-image",
            src: option.icon.src,
            alt: option.icon.alt ?? null,
            name: option.label,
          }}
          className="h-4 w-4"
        />
      </span>
    );
  }
  return <Bot className="h-4 w-4 shrink-0" />;
}

export function ChatSidebarDesktopToolbar(props: ChatSidebarToolbarProps) {
  const {
    query,
    selectedNewSessionType,
    selectedNewSessionTypeOption,
    sessionTypeOptions,
    isCreateMenuOpen,
    onCreateMenuOpenChange,
    onCreateSession,
    onSelectNewSessionType,
    onQueryChange,
    collapsed = false,
  } = props;
  const supportsSessionTypeSwitch = sessionTypeOptions.length > 1;
  const actionStyle =
    NEW_SESSION_ACTION_STYLE_CLASSES[NEW_SESSION_ACTION_STYLE_VARIANT];

  if (collapsed) {
    return (
      <div className="px-2 pb-2">
        <div
          className={cn(
            "flex flex-col items-center",
            SIDEBAR_RAIL_ITEM_GAP_CLASS,
          )}
        >
          <IconActionButton
            icon={<Plus className={SIDEBAR_RAIL_ICON_CLASS} />}
            label={t("chatSidebarNewTask")}
            className={cn(
              SIDEBAR_RAIL_CONTROL_CLASS,
              SIDEBAR_RAIL_SURFACE_CLASS,
            )}
            onClick={() => {
              onCreateMenuOpenChange(false);
              onCreateSession(selectedNewSessionType);
            }}
          />
          {supportsSessionTypeSwitch ? (
            <Popover
              open={isCreateMenuOpen}
              onOpenChange={onCreateMenuOpenChange}
            >
              <PopoverTrigger asChild>
                <IconActionButton
                  icon={
                    <SessionTypeTriggerIcon
                      option={selectedNewSessionTypeOption}
                    />
                  }
                  label={t("chatSessionTypeLabel")}
                  className={cn(
                    SIDEBAR_RAIL_CONTROL_CLASS,
                    SIDEBAR_RAIL_SURFACE_CLASS,
                  )}
                />
              </PopoverTrigger>
              <ChatPopoverContent
                align="start"
                side="right"
                className="w-56 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-[0_24px_60px_-28px_rgba(15,23,42,0.38)]"
              >
                <ChatSessionTypeMenu
                  options={sessionTypeOptions}
                  selectedSessionType={selectedNewSessionType}
                  onSelect={(sessionType) => {
                    onSelectNewSessionType(sessionType);
                    onCreateMenuOpenChange(false);
                  }}
                />
              </ChatPopoverContent>
            </Popover>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2">
          <Button
            variant={actionStyle.leftVariant}
            className={cn(
              "min-w-0 rounded-xl",
              actionStyle.leftClassName,
              supportsSessionTypeSwitch ? "flex-1 rounded-r-md" : "w-full",
            )}
            onClick={() => {
              onCreateMenuOpenChange(false);
              onCreateSession(selectedNewSessionType);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("chatSidebarNewTask")}
          </Button>
          {supportsSessionTypeSwitch ? (
            <Popover
              open={isCreateMenuOpen}
              onOpenChange={onCreateMenuOpenChange}
            >
              <PopoverTrigger asChild>
                <IconActionButton
                  icon={
                    <span className="inline-flex items-center gap-0.5">
                      <SessionTypeTriggerIcon
                        option={selectedNewSessionTypeOption}
                      />
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </span>
                  }
                  label={t("chatSessionTypeLabel")}
                  tooltip={t("chatSessionTypeLabel")}
                  className={cn(
                    "h-9 w-12 shrink-0 rounded-xl rounded-l-md",
                    actionStyle.rightClassName,
                  )}
                />
              </PopoverTrigger>
              <ChatPopoverContent
                align="end"
                className="w-56 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-[0_24px_60px_-28px_rgba(15,23,42,0.38)]"
              >
                <ChatSessionTypeMenu
                  options={sessionTypeOptions}
                  selectedSessionType={selectedNewSessionType}
                  onSelect={(sessionType) => {
                    onSelectNewSessionType(sessionType);
                    onCreateMenuOpenChange(false);
                  }}
                />
              </ChatPopoverContent>
            </Popover>
          ) : null}
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground/70" />
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
    isCreateMenuOpen,
    onCreateMenuOpenChange,
    onCreateSession,
    onQueryChange,
  } = props;
  const hasCreateMenu = sessionTypeOptions.length > 1;

  return (
    <div className="px-4 pb-2 pt-1">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t("chatSidebarSearchPlaceholder")}
            className="h-9 rounded-full border-transparent bg-muted pl-9 pr-3 text-[13px] shadow-none focus:border-border focus:bg-card"
          />
        </div>

        {hasCreateMenu ? (
          <Popover
            open={isCreateMenuOpen}
            onOpenChange={onCreateMenuOpenChange}
          >
            <PopoverTrigger asChild>
              <IconActionButton
                icon={<Plus className="h-4 w-4" />}
                label={t("chatSidebarNewTask")}
                tooltip={false}
                className="h-9 w-9 shrink-0 rounded-full bg-muted text-foreground shadow-none hover:bg-accent hover:text-accent-foreground"
              />
            </PopoverTrigger>
            <ChatPopoverContent
              align="end"
              className="w-60 rounded-3xl border border-border bg-popover p-2 text-popover-foreground shadow-[0_24px_70px_-30px_rgba(15,23,42,0.45)]"
            >
              <ChatSessionTypeMenu
                options={sessionTypeOptions}
                selectedSessionType={defaultSessionType}
                title={t("chatSidebarNewTask")}
                titleClassName="pb-1.5 text-[11px] font-medium normal-case tracking-normal"
                onSelect={(sessionType) => {
                  onCreateSession(sessionType);
                  onCreateMenuOpenChange(false);
                }}
              />
            </ChatPopoverContent>
          </Popover>
        ) : (
          <IconActionButton
            icon={<Plus className="h-4 w-4" />}
            label={t("chatSidebarNewTask")}
            className="h-9 w-9 shrink-0 rounded-full bg-muted text-foreground shadow-none hover:bg-accent hover:text-accent-foreground"
            onClick={() => onCreateSession(defaultSessionType)}
          />
        )}
      </div>
    </div>
  );
}
