import { useEffect } from 'react';
import { usePresenter } from '@/features/chat/components/providers/chat-presenter.provider';
import { useNcpSessionSkills, useNcpSessions } from '@/features/chat/features/ncp/hooks/use-ncp-session-queries';
import { useNcpChatSessionTypes } from '@/features/chat/features/session-type/hooks/use-ncp-chat-session-types';
import { useConfig, useProviders, useProviderTemplates } from '@/shared/hooks/use-config';

export function useNcpChatQueryStoreSync(params: { sessionKey: string | null }) {
  const presenter = usePresenter();
  const configQuery = useConfig();
  const providersQuery = useProviders();
  const templatesQuery = useProviderTemplates();
  const sessionsQuery = useNcpSessions({ limit: 200 });
  const sessionTypesQuery = useNcpChatSessionTypes();
  const sessionId = params.sessionKey?.trim() || 'draft-session';
  const sessionSkillsQuery = useNcpSessionSkills({ sessionId });

  useEffect(() => {
    presenter.chatQueryManager.syncSnapshot({
      configQuery,
      providersQuery,
      providerTemplatesQuery: templatesQuery,
      sessionsQuery,
      sessionTypesQuery,
      sessionSkillsSessionId: sessionId,
      sessionSkillsQuery,
    });
  }, [configQuery, presenter.chatQueryManager, providersQuery, sessionId, sessionSkillsQuery, sessionsQuery, sessionTypesQuery, templatesQuery]);
}
