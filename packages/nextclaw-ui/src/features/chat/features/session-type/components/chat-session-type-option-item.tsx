import { SessionContextIconNode } from "@/features/chat/features/session/components/session-context-icon";
import type { ChatSessionTypeOption } from "@/features/chat/features/session-type/utils/chat-session-type.utils";
import { StatusDot } from "@/shared/components/status/status-dot";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { Bot, Check } from "lucide-react";

type SessionTypeOption = ChatSessionTypeOption;

export function ChatSessionTypeOptionItem(props: {
  option: SessionTypeOption;
  selected?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const { disabled = false, option, onSelect, selected = false } = props;
  const helperText =
    option.ready === false
      ? option.reasonMessage?.trim() || t("statusSetup")
      : null;

  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl px-3 py-2.5 text-left transition-colors",
        selected ? "bg-gray-50" : "hover:bg-gray-50",
        disabled ? "cursor-not-allowed opacity-70" : null,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {option.icon?.src ? (
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center pt-0.5">
              <SessionContextIconNode
                icon={{
                  kind: "runtime-image",
                  src: option.icon.src,
                  alt: option.icon.alt ?? null,
                  name: option.label,
                }}
              />
            </span>
          ) : (
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center pt-0.5 text-gray-700"><Bot className="h-4 w-4" strokeWidth={2.4} /></span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="truncate text-[13px] font-semibold text-gray-900">
                {option.label}
              </div>
              <StatusDot
                status={option.ready === false ? "warning" : "ready"}
                label={option.ready === false ? t("statusSetup") : t("statusReady")}
                className="bg-transparent px-0"
              />
            </div>
            {helperText ? (
              <div className="mt-1 pr-4 text-[11px] leading-4 text-gray-500">
                {helperText}
              </div>
            ) : null}
          </div>
        </div>
        {selected ? (
          <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" />
        ) : null}
      </div>
    </button>
  );
}
