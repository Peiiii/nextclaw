import { useChatInputBarController } from '@/components/chat/chat-input/useChatInputBarController';
import { ChatInputBottomToolbar } from '@/components/chat/chat-input/ChatInputBottomToolbar';
import { ChatInputModelStateHint } from '@/components/chat/chat-input/components/ChatInputModelStateHint';
import { ChatInputSelectedSkillsSection } from '@/components/chat/chat-input/components/ChatInputSelectedSkillsSection';
import { ChatInputSlashPanelSection } from '@/components/chat/chat-input/components/ChatInputSlashPanelSection';
import { usePresenter } from '@/components/chat/presenter/chat-presenter-context';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import { t } from '@/lib/i18n';

export function ChatInputBarView() {
  const presenter = usePresenter();
  const snapshot = useChatInputStore((state) => state.snapshot);

  const hasModelOptions = snapshot.modelOptions.length > 0;
  const isModelOptionsLoading = !snapshot.isProviderStateResolved && !hasModelOptions;
  const isModelOptionsEmpty = snapshot.isProviderStateResolved && !hasModelOptions;
  const inputDisabled = ((isModelOptionsLoading || isModelOptionsEmpty) && !snapshot.isSending) || snapshot.sessionTypeUnavailable;
  const textareaPlaceholder = isModelOptionsLoading
    ? ''
    : hasModelOptions
      ? t('chatInputPlaceholder')
      : t('chatModelNoOptions');

  const controller = useChatInputBarController({
    draft: snapshot.draft,
    onDraftChange: presenter.chatInputManager.setDraft,
    onSend: presenter.chatInputManager.send,
    onStop: presenter.chatInputManager.stop,
    canStopGeneration: snapshot.canStopGeneration,
    isSending: snapshot.isSending,
    skillRecords: snapshot.skillRecords,
    isSkillsLoading: snapshot.isSkillsLoading,
    selectedSkills: snapshot.selectedSkills,
    onSelectedSkillsChange: presenter.chatInputManager.selectSkills
  });

  return (
    <div className="border-t border-gray-200/80 bg-white p-4">
      <div className="mx-auto w-full max-w-[min(1120px,100%)]">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-card overflow-hidden">
          <div className="relative">
            <textarea
              value={snapshot.draft}
              onChange={(event) => presenter.chatInputManager.setDraft(event.target.value)}
              disabled={inputDisabled}
              onKeyDown={controller.onTextareaKeyDown}
              placeholder={textareaPlaceholder}
              className="w-full min-h-[68px] max-h-[220px] resize-y bg-transparent outline-none text-sm px-4 py-3 text-gray-800 placeholder:text-gray-400"
            />
            <ChatInputSlashPanelSection
              slashAnchorRef={controller.slashAnchorRef}
              slashListRef={controller.slashListRef}
              isSlashPanelOpen={controller.isSlashPanelOpen}
              isSlashPanelLoading={controller.isSlashPanelLoading}
              resolvedSlashPanelWidth={controller.resolvedSlashPanelWidth}
              skillSlashItems={controller.skillSlashItems}
              activeSlashIndex={controller.activeSlashIndex}
              activeSlashItem={controller.activeSlashItem}
              onSelectSlashItem={controller.onSelectSlashItem}
              onSlashPanelOpenChange={controller.onSlashPanelOpenChange}
              onSetActiveSlashIndex={controller.onSetActiveSlashIndex}
            />
          </div>

          <ChatInputModelStateHint
            isModelOptionsLoading={isModelOptionsLoading}
            isModelOptionsEmpty={isModelOptionsEmpty}
            onGoToProviders={presenter.chatInputManager.goToProviders}
          />

          <ChatInputSelectedSkillsSection
            records={controller.selectedSkillRecords}
            selectedSkills={snapshot.selectedSkills}
            onSelectedSkillsChange={presenter.chatInputManager.selectSkills}
          />

          <ChatInputBottomToolbar />
        </div>
      </div>
    </div>
  );
}
