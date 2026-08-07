import {
  useCallback,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
} from 'react';
import type { NcpMessage } from '@nextclaw/ncp';
import {
  ChatComposerEditor,
  type ChatComposerEditorHandle,
} from '@nextclaw/agent-chat-ui';

import {
  deriveChatComposerDraft,
  deriveNcpMessagePartsFromComposer,
  deriveSelectedSkillsFromComposer,
  pruneComposerAttachments,
} from '@/features/chat/features/input/utils/chat-composer-state.utils';
import type { SessionMessageComposerSnapshot } from '@/features/chat/features/conversation/utils/session-message-composer.utils';
import { t } from '@/shared/lib/i18n';

function hasSendableParts(parts: NcpMessage['parts']): boolean {
  return parts.some((part) =>
    part.type === 'text' || part.type === 'rich-text' || part.type === 'reasoning'
      ? part.text.trim().length > 0
      : true,
  );
}

export function ChatMessageInlineEditor({
  disabled,
  messageId,
  onCancel,
  onChange,
  onSave,
  snapshot,
}: {
  readonly disabled: boolean;
  readonly messageId: string;
  readonly onCancel: () => void;
  readonly onChange: (snapshot: SessionMessageComposerSnapshot) => void;
  readonly onSave: () => Promise<void>;
  readonly snapshot: SessionMessageComposerSnapshot;
}) {
  const editorRef = useRef<ChatComposerEditorHandle | null>(null);
  const initialNodesRef = useRef([...snapshot.nodes]);
  const parts = deriveNcpMessagePartsFromComposer(
    [...snapshot.nodes],
    snapshot.attachments,
  );
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onCancel();
  }, [onCancel]);
  useLayoutEffect(() => {
    editorRef.current?.focusComposerAtEnd(initialNodesRef.current);
  }, [messageId]);

  return (
    <div
      className="w-full min-w-[min(32rem,76vw)] overflow-hidden rounded-xl border border-border bg-card shadow-sm"
      onKeyDownCapture={handleKeyDown}
    >
      <ChatComposerEditor
        ref={editorRef}
        key={messageId}
        actions={{
          canStopGeneration: false,
          isSending: disabled,
          onSend: onSave,
          onStop: () => undefined,
        }}
        disabled={disabled}
        nodes={[...snapshot.nodes]}
        onNodesChange={(nodes) => {
          const nextNodes = [...nodes];
          onChange({
            ...snapshot,
            attachments: pruneComposerAttachments(nextNodes, snapshot.attachments),
            nodes: nextNodes,
            selectedSkills: deriveSelectedSkillsFromComposer(nextNodes),
            text: deriveChatComposerDraft(nextNodes),
          });
        }}
        placeholder={t('chatEditMessagePlaceholder')}
      />
      <div className="flex justify-end gap-2 border-t border-border/70 px-3 py-2">
        <button
          type="button"
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-[var(--interaction-hover)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          disabled={disabled}
          onClick={onCancel}
        >
          {t('chatEditMessageCancel')}
        </button>
        <button
          type="button"
          className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled || !hasSendableParts(parts)}
          onClick={() => void onSave()}
        >
          {t('chatEditMessageSubmit')}
        </button>
      </div>
    </div>
  );
}
