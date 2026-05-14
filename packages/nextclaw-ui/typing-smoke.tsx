import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChatMessageList } from '@nextclaw/agent-chat-ui';
import './src/index.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50/60 to-white p-8">
    <div className="w-full max-w-xl">
      <ChatMessageList
        messages={[
          {
            id: 'user-smoke',
            role: 'user',
            roleLabel: 'You',
            timestampLabel: '19:52',
            parts: [{ type: 'markdown', text: '帮我整理一下今天的工作。' }]
          }
        ]}
        isSending
        hasAssistantDraft={false}
        texts={{
          copyCodeLabel: 'Copy',
          copiedCodeLabel: 'Copied',
          copyMessageLabel: 'Copy',
          copiedMessageLabel: 'Copied',
          typingLabel: 'Agent 正在思考...'
        }}
      />
    </div>
  </main>
);
