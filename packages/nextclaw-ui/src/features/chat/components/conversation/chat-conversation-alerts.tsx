import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import { useChatInputStore } from "@/features/chat/stores/chat-input.store";
import { t } from "@/shared/lib/i18n";

export function ChatConversationAlerts() {
  const presenter = usePresenter();
  const snapshot = useChatInputStore((state) => state.snapshot);
  const shouldShowProviderHint =
    snapshot.isProviderStateResolved && snapshot.modelOptions.length === 0;

  return (
    <>
      {shouldShowProviderHint ? (
        <div className="px-4 py-2.5 border-b border-amber-200/70 bg-amber-50/70 flex items-center justify-between gap-3 shrink-0 sm:px-5">
          <span className="text-xs text-amber-800">
            {t("chatModelNoOptions")}
          </span>
          <button
            type="button"
            onClick={presenter.chatThreadManager.goToProviders}
            className="text-xs font-semibold text-amber-900 underline-offset-2 hover:underline"
          >
            {t("chatGoConfigureProvider")}
          </button>
        </div>
      ) : null}
      {snapshot.sessionTypeUnavailable &&
      snapshot.sessionTypeUnavailableMessage?.trim() ? (
        <div className="px-4 py-2.5 border-b border-amber-200/70 bg-amber-50/70 shrink-0 sm:px-5">
          <span className="text-xs text-amber-800">
            {snapshot.sessionTypeUnavailableMessage}
          </span>
        </div>
      ) : null}
    </>
  );
}
