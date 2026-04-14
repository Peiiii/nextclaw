import type { ChatPageProps } from '@/components/chat/chat-page-shell';
import { NcpChatPage } from '@/components/chat/ncp/ncp-chat-page';

export function ChatPage({ view }: ChatPageProps) {
  return <NcpChatPage view={view} />;
}
