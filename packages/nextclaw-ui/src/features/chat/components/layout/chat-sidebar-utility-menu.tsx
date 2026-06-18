import { NavLink } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/shared/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { t, type I18nLanguage } from "@/shared/lib/i18n";
import type { UiTheme } from "@/shared/lib/theme";
import { cn } from "@/shared/lib/utils";
import {
  SIDEBAR_RAIL_CONTROL_CLASS,
  SIDEBAR_RAIL_ICON_CLASS,
  SIDEBAR_RAIL_SURFACE_CLASS,
} from "@/app/components/layout/sidebar-rail.styles";
import {
  BookOpen,
  ChevronRight,
  Boxes,
  Languages,
  Palette,
  Settings,
  type LucideIcon,
} from "lucide-react";

type ChatSidebarUtilityOption<Value extends string> = {
  value: Value;
  label: string;
};

type ChatSidebarUtilityMenuProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentTheme: UiTheme;
  currentThemeLabel: string;
  themeOptions: ChatSidebarUtilityOption<UiTheme>[];
  onSelectTheme: (theme: UiTheme) => void;
  currentLanguage: I18nLanguage;
  currentLanguageLabel: string;
  languageOptions: ChatSidebarUtilityOption<I18nLanguage>[];
  onSelectLanguage: (language: I18nLanguage) => void;
  onOpenDocs: () => void;
  onOpenApps: () => void;
  collapsed?: boolean;
};

export function ChatSidebarUtilityMenu({
  isOpen,
  onOpenChange,
  currentTheme,
  currentThemeLabel,
  themeOptions,
  onSelectTheme,
  currentLanguage,
  currentLanguageLabel,
  languageOptions,
  onSelectLanguage,
  onOpenDocs,
  onOpenApps,
  collapsed = false,
}: ChatSidebarUtilityMenuProps) {
  const handleOpenDocs = () => {
    onOpenDocs();
    onOpenChange(false);
  };

  const handleOpenApps = () => {
    onOpenApps();
    onOpenChange(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      {collapsed ? (
        <TooltipProvider delayDuration={250}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={t("settingsMenu")}
                  className={cn(
                    "flex items-center justify-center",
                    SIDEBAR_RAIL_CONTROL_CLASS,
                    SIDEBAR_RAIL_SURFACE_CLASS,
                  )}
                >
                  <Settings
                    className={cn(
                      SIDEBAR_RAIL_ICON_CLASS,
                      "shrink-0 text-gray-500",
                    )}
                  />
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {t("settingsMenu")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("settingsMenu")}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-gray-600 transition-all duration-base hover:bg-gray-200/60 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <Settings className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="min-w-0 flex-1 text-left">{t("settings")}</span>
            <span className="max-w-[112px] truncate text-[13px] text-gray-500">
              {currentThemeLabel} / {currentLanguageLabel}
            </span>
          </button>
        </PopoverTrigger>
      )}
      <PopoverContent
        side={collapsed ? "right" : "top"}
        align={collapsed ? "end" : "start"}
        className="w-64 p-2"
      >
        <div className="space-y-1">
          <NavLink
            to="/settings"
            onClick={() => onOpenChange(false)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            <Settings className="h-4 w-4 text-gray-400" />
            <span className="flex-1 text-left">{t("settings")}</span>
          </NavLink>
          <button
            type="button"
            onClick={handleOpenDocs}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            <BookOpen className="h-4 w-4 text-gray-400" />
            <span className="flex-1 text-left">{t("docBrowserHelp")}</span>
          </button>
          <button
            type="button"
            onClick={handleOpenApps}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            <Boxes className="h-4 w-4 text-gray-400" />
            <span className="flex-1 text-left">{t("appsTitle")}</span>
          </button>
        </div>

        <div className="my-2 h-px bg-gray-200/70" />

        <ChatSidebarUtilitySelect
          icon={Palette}
          label={t("theme")}
          options={themeOptions}
          value={currentTheme}
          valueLabel={currentThemeLabel}
          onSelect={onSelectTheme}
          onCloseMenu={() => onOpenChange(false)}
        />

        <ChatSidebarUtilitySelect
          icon={Languages}
          label={t("language")}
          options={languageOptions}
          value={currentLanguage}
          valueLabel={currentLanguageLabel}
          onSelect={onSelectLanguage}
          onCloseMenu={() => onOpenChange(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

function ChatSidebarUtilitySelect<Value extends string>({
  icon: Icon,
  label,
  options,
  value,
  valueLabel,
  onSelect,
  onCloseMenu,
}: {
  icon: LucideIcon;
  label: string;
  options: ChatSidebarUtilityOption<Value>[];
  value: Value;
  valueLabel: string;
  onSelect: (value: Value) => void;
  onCloseMenu: () => void;
}) {
  return (
    <Select
      value={value}
      onOpenChange={(open) => {
        if (!open) {
          onCloseMenu();
        }
      }}
      onValueChange={(nextValue) => onSelect(nextValue as Value)}
    >
      <SelectTrigger
        aria-label={label}
        className="h-auto w-full rounded-lg border-0 bg-transparent px-3 py-2 text-[13px] font-medium text-gray-700 shadow-none hover:bg-gray-100 focus:ring-0"
        indicator={<ChevronRight className="h-4 w-4 text-gray-400" />}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Icon className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="text-left">{label}</span>
        </div>
        <span className="ml-auto max-w-[96px] truncate text-[13px] text-gray-500">
          {valueLabel}
        </span>
      </SelectTrigger>
      <SelectContent
        side="right"
        align="center"
        sideOffset={6}
        className="z-[var(--z-tooltip)] min-w-[7rem] rounded-lg"
        viewportClassName="h-auto min-w-[7rem] w-auto"
      >
        {options.map((option) => {
          return (
            <SelectItem
              key={option.value}
              value={option.value}
              className="text-[13px]"
            >
              {option.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
