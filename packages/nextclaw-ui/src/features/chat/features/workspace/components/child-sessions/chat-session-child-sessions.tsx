import { ChevronRight, GitBranch, MessageSquarePlus } from 'lucide-react';

import { usePresenter } from '@/features/chat/components/providers/chat-presenter.provider';
import type { ResolvedChildSessionTab } from '@/features/chat/features/ncp/hooks/use-ncp-child-session-tabs-view';
import { t } from '@/shared/lib/i18n';

export function ChatSessionChildSessions({
  childSessionTabs,
  sessionKey,
}: {
  childSessionTabs: readonly ResolvedChildSessionTab[];
  sessionKey: string | null;
}) {
  const presenter = usePresenter();

  return (
    <div className="h-full overflow-auto bg-gray-50/45 px-4 py-5 custom-scrollbar">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-base font-semibold text-gray-900">{t('chatWorkspaceChildSessions')}</h2>
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gray-500">
              {childSessionTabs.length}
            </span>
          </div>
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!sessionKey}
            onClick={() => presenter.chatThreadManager.openSideChatDraft(sessionKey)}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            <span>{t('chatWorkspaceCreateChildSession')}</span>
          </button>
        </div>
        {childSessionTabs.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">{t('chatWorkspaceChildSessionsEmpty')}</div>
        ) : (
          <div className="mt-4 space-y-2">
            {childSessionTabs.map((tab) => (
              <button
                key={tab.sessionKey}
                type="button"
                className="group flex w-full items-center gap-3 rounded-lg border border-gray-200/80 bg-white px-3 py-3 text-left transition-colors hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                onClick={() => presenter.chatThreadManager.selectChildSessionDetail(tab.sessionKey)}
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                  <GitBranch className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">{tab.title}</span>
                  {tab.projectName || tab.sessionTypeLabel ? (
                    <span className="mt-0.5 block truncate text-xs text-gray-500">
                      {[tab.sessionTypeLabel, tab.projectName].filter(Boolean).join(' · ')}
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
