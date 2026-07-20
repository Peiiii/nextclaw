import { useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { compactNcpSessionContext } from '@/shared/lib/api';
import { t, type I18nLanguage } from '@/shared/lib/i18n';
import { usePresenter } from '@/features/chat/components/providers/chat-presenter.provider';
import type { ChatSlashCommandDescriptor } from '@/features/chat/features/input/input-surface-plugins/slash-command-plugin.utils';

export function useSessionConversationSlashCommands(params: {
  language: I18nLanguage;
  selectedSessionKey?: string | null;
}): readonly ChatSlashCommandDescriptor[] {
  const { language, selectedSessionKey } = params;
  const presenter = usePresenter();
  const compactingSessionIdsRef = useRef(new Set<string>());
  const compactContext = useCallback(async (sessionId: string) => {
    if (compactingSessionIdsRef.current.has(sessionId)) {
      return;
    }
    compactingSessionIdsRef.current.add(sessionId);
    try {
      await compactNcpSessionContext(sessionId);
      toast.success(t('chatSlashCommandCompactContextSuccess', language));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`${t('chatSlashCommandCompactContextFailed', language)}: ${message}`);
    } finally {
      compactingSessionIdsRef.current.delete(sessionId);
    }
  }, [language]);

  return useMemo(() => {
    const sessionId = selectedSessionKey?.trim();
    if (!sessionId) {
      return [];
    }
    return [
      {
        key: 'side-chat',
        title: t('chatSlashCommandSideChatTitle', language),
        description: t('chatSlashCommandSideChatDescription', language),
        detailLines: [t('chatSlashCommandSideChatDetail', language)],
        keywords: ['side', 'chat', 'child', 'branch', 'new'],
        onSelect: () => presenter.chatThreadManager.openSideChatDraft(sessionId),
      },
      {
        key: 'compact-context',
        title: t('chatSlashCommandCompactContextTitle', language),
        description: t('chatSlashCommandCompactContextDescription', language),
        detailLines: [t('chatSlashCommandCompactContextDetail', language)],
        keywords: ['compact', 'compress', 'context', 'summary', '压缩', '上下文'],
        onSelect: () => void compactContext(sessionId),
      },
    ];
  }, [compactContext, language, presenter.chatThreadManager, selectedSessionKey]);
}
