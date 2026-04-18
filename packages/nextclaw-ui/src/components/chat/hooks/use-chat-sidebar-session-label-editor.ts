import { useState } from 'react';
import type { SessionEntryView } from '@/api/types';
import { useChatSessionLabel } from '@/components/chat/hooks/use-chat-session-label';

export function useChatSidebarSessionLabelEditor() {
  const updateSessionLabel = useChatSessionLabel();
  const [editingSessionKey, setEditingSessionKey] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [savingSessionKey, setSavingSessionKey] = useState<string | null>(null);

  const startEditingSessionLabel = (session: SessionEntryView) => {
    setEditingSessionKey(session.key);
    setDraftLabel(session.label?.trim() ?? '');
  };
  const cancelEditingSessionLabel = () => {
    setEditingSessionKey(null);
    setDraftLabel('');
    setSavingSessionKey(null);
  };
  const saveSessionLabel = async (session: SessionEntryView) => {
    const normalizedLabel = draftLabel.trim();
    const currentLabel = session.label?.trim() ?? '';
    if (normalizedLabel === currentLabel) {
      cancelEditingSessionLabel();
      return;
    }

    setSavingSessionKey(session.key);
    try {
      await updateSessionLabel({
        sessionKey: session.key,
        label: normalizedLabel || null,
      });
      cancelEditingSessionLabel();
    } catch {
      setSavingSessionKey(null);
    }
  };

  return {
    editingSessionKey,
    draftLabel,
    savingSessionKey,
    setDraftLabel,
    startEditingSessionLabel,
    cancelEditingSessionLabel,
    saveSessionLabel,
  };
}
