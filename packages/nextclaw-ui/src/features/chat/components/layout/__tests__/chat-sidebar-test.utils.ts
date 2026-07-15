import type { NcpSessionListItemView } from '@/features/chat/features/ncp/hooks/use-ncp-session-list-view';
import { useChatQueryStore } from '@/features/chat/stores/ncp-chat-query.store';
import type { ChatSessionTypeOptionView } from '@/shared/lib/api';

export function createSidebarSessionItem(
  session: NcpSessionListItemView['session'],
  runStatus?: NcpSessionListItemView['runStatus'],
): NcpSessionListItemView {
  return { session, runStatus };
}

export function setSidebarSessionTypes(
  options: ChatSessionTypeOptionView[],
  defaultType = 'native',
) {
  useChatQueryStore.setState({
    snapshot: {
      ...useChatQueryStore.getState().snapshot,
      sessionTypesQuery: { data: { defaultType, options } } as never,
    },
  });
}
