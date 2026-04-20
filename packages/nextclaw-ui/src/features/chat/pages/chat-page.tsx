import type { ChatPageProps } from '@/features/chat/components/layout/chat-page-shell';
import { NcpChatPage } from '@/features/chat/pages/ncp-chat-page';

export function ChatPage({ view }: ChatPageProps) {
  return <NcpChatPage view={view} />;
}
