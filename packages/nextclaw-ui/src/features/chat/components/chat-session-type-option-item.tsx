import type { ChatInputSnapshot } from "@/features/chat/stores/chat-input.store";
import { SessionContextIconNode } from "@/features/chat/components/session/session-context-icon";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

type SessionTypeOption = ChatInputSnapshot["sessionTypeOptions"][number];

export function ChatSessionTypeOptionItem(props: {
  option: SessionTypeOption;
  onSelect: () => void;
}) {
  const { option, onSelect } = props;
  const helperText =
    option.ready === false
      ? option.reasonMessage?.trim() || t("statusSetup")
      : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
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
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="truncate text-[13px] font-semibold text-gray-900">
                {option.label}
              </div>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium",
                  option.ready === false ? "text-amber-700" : "text-emerald-600",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    option.ready === false ? "bg-amber-500" : "bg-emerald-500",
                  )}
                />
                {option.ready === false ? t("statusSetup") : t("statusReady")}
              </span>
            </div>
            {helperText ? (
              <div className="mt-1 pr-4 text-[11px] leading-4 text-gray-500">
                {helperText}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}
