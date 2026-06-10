import { create } from 'zustand';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ChatSessionTypesView, ConfigView, NcpSessionSkillsView, NcpSessionsListView, ProviderTemplatesView, ProvidersView } from '@/shared/lib/api';

type Query<TData> = UseQueryResult<TData, Error>;

export type NcpChatQuerySnapshot = Partial<{
  configQuery: Query<ConfigView> | null;
  providersQuery: Query<ProvidersView> | null;
  providerTemplatesQuery: Query<ProviderTemplatesView> | null;
  sessionsQuery: Query<NcpSessionsListView> | null;
  sessionTypesQuery: Query<ChatSessionTypesView> | null;
  sessionSkillsSessionId: string | null;
  sessionSkillsQuery: Query<NcpSessionSkillsView> | null;
}>;

type NcpChatQueryStore = {
  snapshot: NcpChatQuerySnapshot;
  setSnapshot: (patch: Partial<NcpChatQuerySnapshot>) => void;
};

export const useNcpChatQueryStore = create<NcpChatQueryStore>((set) => ({
  snapshot: {},
  setSnapshot: (patch) => set(({ snapshot }) => ({ snapshot: { ...snapshot, ...patch } })),
}));
