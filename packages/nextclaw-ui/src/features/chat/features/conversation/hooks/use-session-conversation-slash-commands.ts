import { useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { compactNcpSessionContext } from '@/shared/lib/api';
import { t, type I18nLanguage } from '@/shared/lib/i18n';
import { usePresenter } from '@/features/chat/components/providers/chat-presenter.provider';
import type { ChatSlashCommandDescriptor } from '@/features/chat/features/input/input-surface-plugins/slash-command-plugin.utils';

export function useSessionConversationSlashCommands(params: {
  language: I18nLanguage;
  onContextCompactingChange?: (sessionId: string, isCompacting: boolean) => void;
  onSendPresetMessage: (message: string) => Promise<void> | void;
  selectedSessionKey?: string | null;
}): readonly ChatSlashCommandDescriptor[] {
  const {
    language,
    onContextCompactingChange,
    onSendPresetMessage,
    selectedSessionKey,
  } = params;
  const presenter = usePresenter();
  const compactingSessionIdsRef = useRef(new Set<string>());
  const compactContext = useCallback(async (sessionId: string) => {
    if (compactingSessionIdsRef.current.has(sessionId)) {
      return;
    }
    compactingSessionIdsRef.current.add(sessionId);
    onContextCompactingChange?.(sessionId, true);
    try {
      await compactNcpSessionContext(sessionId);
      toast.success(t('chatSlashCommandCompactContextSuccess', language));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`${t('chatSlashCommandCompactContextFailed', language)}: ${message}`);
    } finally {
      compactingSessionIdsRef.current.delete(sessionId);
      onContextCompactingChange?.(sessionId, false);
    }
  }, [language, onContextCompactingChange]);

  return useMemo(() => {
    const sessionId = selectedSessionKey?.trim();
    if (!sessionId) {
      return [];
    }
    return [
      {
        key: 'side-chat',
        icon: 'message-square-plus',
        title: t('chatSlashCommandSideChatTitle', language),
        description: t('chatSlashCommandSideChatDescription', language),
        detailLines: [t('chatSlashCommandSideChatDetail', language)],
        keywords: ['side', 'chat', 'child', 'branch', 'new'],
        onSelect: () => presenter.chatThreadManager.openSideChatDraft(sessionId),
      },
      {
        key: 'update-session-title',
        icon: 'command',
        title: t('chatSlashCommandUpdateSessionTitleTitle', language),
        description: t('chatSlashCommandUpdateSessionTitleDescription', language),
        detailLines: [t('chatSlashCommandUpdateSessionTitleDetail', language)],
        keywords: ['update', 'rename', 'title', 'session', '更新', '重命名', '标题', '会话'],
        onSelect: () => void onSendPresetMessage(
          t('chatSlashCommandUpdateSessionTitlePrompt', language),
        ),
      },
      {
        key: 'compact-context',
        icon: 'list-collapse',
        title: t('chatSlashCommandCompactContextTitle', language),
        description: t('chatSlashCommandCompactContextDescription', language),
        detailLines: [t('chatSlashCommandCompactContextDetail', language)],
        keywords: ['compact', 'compress', 'context', 'summary', '压缩', '上下文'],
        onSelect: () => void compactContext(sessionId),
      },
    ];
  }, [
    compactContext,
    language,
    onSendPresetMessage,
    presenter.chatThreadManager,
    selectedSessionKey,
  ]);
}
