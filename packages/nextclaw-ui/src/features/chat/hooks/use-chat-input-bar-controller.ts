import { useCallback, useEffect, useState } from 'react';
import type { ChatSlashItem } from '@nextclaw/agent-chat-ui';
import type { KeyboardEvent } from 'react';

type UseChatInputBarControllerParams = {
  isSlashMode: boolean;
  slashItems: ChatSlashItem[];
  isSlashLoading: boolean;
  onSelectSlashItem: (item: ChatSlashItem) => void;
  onSend: () => Promise<void> | void;
  onStop: () => Promise<void> | void;
  isSending: boolean;
  canStopGeneration: boolean;
};

function isSubmitKey(event: Pick<KeyboardEvent<HTMLTextAreaElement>, 'key' | 'shiftKey'>): boolean {
  return event.key === 'Enter' && !event.shiftKey;
}

function isSlashDismissKey(event: Pick<KeyboardEvent<HTMLTextAreaElement>, 'key' | 'code' | 'nativeEvent'>): boolean {
  return !event.nativeEvent.isComposing && (event.key === ' ' || event.code === 'Space');
}

export function useChatInputBarController(params: UseChatInputBarControllerParams) {
  const {
    isSlashMode,
    slashItems,
    onSelectSlashItem,
    onSend,
    onStop,
    isSending,
    canStopGeneration
  } = params;
  const [activeSlashIndex, setActiveSlashIndex] = useState(0);
  const [dismissedSlashPanel, setDismissedSlashPanel] = useState(false);

  const isSlashPanelOpen = isSlashMode && !dismissedSlashPanel;
  const activeSlashItem = slashItems[activeSlashIndex] ?? null;

  useEffect(() => {
    if (!isSlashPanelOpen || slashItems.length === 0) {
      setActiveSlashIndex(0);
      return;
    }
    setActiveSlashIndex((current) => {
      if (current < 0) {
        return 0;
      }
      if (current >= slashItems.length) {
        return slashItems.length - 1;
      }
      return current;
    });
  }, [isSlashPanelOpen, slashItems.length]);

  useEffect(() => {
    if (!isSlashMode && dismissedSlashPanel) {
      setDismissedSlashPanel(false);
    }
  }, [dismissedSlashPanel, isSlashMode]);

  const handleSelectSlashItem = useCallback((item: ChatSlashItem) => {
    onSelectSlashItem(item);
    setDismissedSlashPanel(false);
  }, [onSelectSlashItem]);

  const handleSlashKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!isSlashPanelOpen || slashItems.length === 0) {
      return false;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSlashIndex((current) => (current + 1) % slashItems.length);
      return true;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSlashIndex((current) => (current - 1 + slashItems.length) % slashItems.length);
      return true;
    }
    if (!isSubmitKey(event) && event.key !== 'Tab') {
      return false;
    }
    event.preventDefault();
    const selected = slashItems[activeSlashIndex];
    if (selected) {
      handleSelectSlashItem(selected);
    }
    return true;
  }, [activeSlashIndex, handleSelectSlashItem, isSlashPanelOpen, slashItems]);

  const handleEscapeKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (event.key !== 'Escape') {
      return false;
    }
    if (isSlashPanelOpen) {
      event.preventDefault();
      setDismissedSlashPanel(true);
      return true;
    }
    if (!isSending || !canStopGeneration) {
      return false;
    }
    event.preventDefault();
    void onStop();
    return true;
  }, [canStopGeneration, isSlashPanelOpen, isSending, onStop]);

  const onTextareaKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSubmitKey(event) && isSending) {
      event.preventDefault();
      return;
    }
    if (isSlashPanelOpen && isSlashDismissKey(event)) {
      setDismissedSlashPanel(true);
    }
    if (handleSlashKeyDown(event)) {
      return;
    }
    if (handleEscapeKeyDown(event)) {
      return;
    }
    if (isSubmitKey(event)) {
      event.preventDefault();
      void onSend();
    }
  }, [handleEscapeKeyDown, handleSlashKeyDown, isSending, isSlashPanelOpen, onSend]);

  return {
    isSlashPanelOpen,
    activeSlashIndex,
    activeSlashItem,
    onSelectSlashItem: handleSelectSlashItem,
    onSlashPanelOpenChange: (open: boolean) => {
      if (!open) {
        setDismissedSlashPanel(true);
      }
    },
    onSetActiveSlashIndex: setActiveSlashIndex,
    onTextareaKeyDown
  };
}
