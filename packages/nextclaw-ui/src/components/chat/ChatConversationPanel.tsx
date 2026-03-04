import type { MutableRefObject } from 'react';
import type { MarketplaceInstalledRecord, SessionEventView } from '@/api/types';
import { Button } from '@/components/ui/button';
import { ChatThread } from '@/components/chat/ChatThread';
import { ChatInputBar, type ChatModelOption } from '@/components/chat/ChatInputBar';
import { ChatWelcome } from '@/components/chat/ChatWelcome';
import { t } from '@/lib/i18n';
import { Trash2 } from 'lucide-react';

type ChatConversationPanelProps = {
  modelOptions: ChatModelOption[];
  selectedModel: string;
  onSelectedModelChange: (value: string) => void;
  skillRecords: MarketplaceInstalledRecord[];
  isSkillsLoading?: boolean;
  selectedSkills: string[];
  onSelectedSkillsChange: (next: string[]) => void;
  selectedSessionKey: string | null;
  sessionDisplayName?: string;
  canDeleteSession: boolean;
  isDeletePending: boolean;
  onDeleteSession: () => void;
  onCreateSession: () => void;
  threadRef: MutableRefObject<HTMLDivElement | null>;
  onThreadScroll: () => void;
  isHistoryLoading: boolean;
  mergedEvents: SessionEventView[];
  isSending: boolean;
  isAwaitingAssistantOutput: boolean;
  streamingAssistantText: string;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => Promise<void> | void;
  onStop: () => Promise<void> | void;
  canStopGeneration: boolean;
  stopDisabledReason?: string | null;
  sendError?: string | null;
  queuedCount: number;
};

export function ChatConversationPanel({
  modelOptions,
  selectedModel,
  onSelectedModelChange,
  skillRecords,
  isSkillsLoading = false,
  selectedSkills,
  onSelectedSkillsChange,
  selectedSessionKey,
  sessionDisplayName,
  canDeleteSession,
  isDeletePending,
  onDeleteSession,
  onCreateSession,
  threadRef,
  onThreadScroll,
  isHistoryLoading,
  mergedEvents,
  isSending,
  isAwaitingAssistantOutput,
  streamingAssistantText,
  draft,
  onDraftChange,
  onSend,
  onStop,
  canStopGeneration,
  stopDisabledReason,
  sendError,
  queuedCount,
}: ChatConversationPanelProps) {
  const showHistoryLoading =
    isHistoryLoading &&
    mergedEvents.length === 0 &&
    !isSending &&
    !isAwaitingAssistantOutput &&
    !streamingAssistantText.trim();

  const showWelcome = !selectedSessionKey && mergedEvents.length === 0;

  return (
    <section className="flex-1 min-h-0 flex flex-col overflow-hidden bg-gradient-to-b from-gray-50/60 to-white">
      {/* Minimal top bar - only shown when session is active */}
      {selectedSessionKey && (
        <div className="px-5 py-3 border-b border-gray-200/60 bg-white/80 backdrop-blur-sm flex items-center justify-between shrink-0">
          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium text-gray-700 truncate">
              {sessionDisplayName || selectedSessionKey}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg shrink-0 text-gray-400 hover:text-destructive"
            onClick={onDeleteSession}
            disabled={!canDeleteSession || isDeletePending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Message thread or welcome */}
      <div ref={threadRef} onScroll={onThreadScroll} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {showWelcome ? (
          <ChatWelcome onCreateSession={onCreateSession} />
        ) : showHistoryLoading ? (
          <div className="px-5 py-5 text-sm text-gray-500">{t('chatHistoryLoading')}</div>
        ) : mergedEvents.length === 0 ? (
          <div className="px-5 py-5 text-sm text-gray-500">{t('chatNoMessages')}</div>
        ) : (
          <div className="mx-auto w-full max-w-[min(1120px,100%)] px-6 py-5">
            <ChatThread events={mergedEvents} isSending={isSending && isAwaitingAssistantOutput} />
          </div>
        )}
      </div>

      {/* Enhanced input bar */}
      <ChatInputBar
        draft={draft}
        onDraftChange={onDraftChange}
        onSend={onSend}
        onStop={onStop}
        canStopGeneration={canStopGeneration}
        stopDisabledReason={stopDisabledReason}
        sendError={sendError}
        isSending={isSending}
        queuedCount={queuedCount}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSelectedModelChange={onSelectedModelChange}
        skillRecords={skillRecords}
        isSkillsLoading={isSkillsLoading}
        selectedSkills={selectedSkills}
        onSelectedSkillsChange={onSelectedSkillsChange}
      />
    </section>
  );
}
