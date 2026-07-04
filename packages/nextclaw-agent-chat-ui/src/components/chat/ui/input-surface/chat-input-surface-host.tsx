import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  ChatComposerNode,
  ChatComposerSelection,
  ChatInputSurfaceConfig,
  ChatInputSurfaceItem,
  ChatInputSurfaceTrigger,
  ChatInputSurfaceTriggerChangeReason,
  ChatInputSurfaceTriggerSpec,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import {
  CHAT_INPUT_SURFACE_SLASH_TRIGGER_SPEC,
  resolveChatComposerActiveInputSurfaceTrigger,
} from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-composer.utils';
import {
  ChatInputSurfaceMenu,
  type ChatInputSurfaceMenuHandle,
} from '@agent-chat-ui/components/chat/ui/input-surface/chat-input-surface-menu';

type ChatInputSurfaceHostBindings = {
  onInputSurfaceKeyDown: (event: KeyboardEvent) => boolean;
  onInputSurfaceOpenChange: (open: boolean) => void;
  onInputSurfaceSnapshotChange: (
    nodes: ChatComposerNode[],
    selection: ChatComposerSelection | null,
    reason: ChatInputSurfaceTriggerChangeReason,
  ) => void;
};

export type ChatInputSurfaceHostProps = {
  inputSurface: ChatInputSurfaceConfig | null;
  onInputSurfaceTriggerChange?: (trigger: ChatInputSurfaceTrigger | null) => void;
  onSelectItem: (item: ChatInputSurfaceItem) => void;
  triggerSpecs?: readonly ChatInputSurfaceTriggerSpec[];
  children: (bindings: ChatInputSurfaceHostBindings) => ReactNode;
};

export function getInputSurfaceTriggerIdentity(trigger: ChatInputSurfaceTrigger): string {
  return `${trigger.key}:${trigger.marker}:${trigger.start}`;
}

export function isInputSurfaceCreateEvent(
  trigger: ChatInputSurfaceTrigger,
  reason: ChatInputSurfaceTriggerChangeReason,
): boolean {
  return (
    reason.type === 'insert-text' &&
    reason.text === trigger.marker &&
    trigger.query === '' &&
    trigger.end === trigger.start + trigger.marker.length
  );
}

export function resolveInputSurfaceTriggerIdentity(
  currentIdentity: string | null,
  trigger: ChatInputSurfaceTrigger | null,
  reason: ChatInputSurfaceTriggerChangeReason,
): string | null {
  if (!trigger) {
    return null;
  }

  const nextIdentity = getInputSurfaceTriggerIdentity(trigger);
  if (currentIdentity === nextIdentity) {
    return currentIdentity;
  }
  return isInputSurfaceCreateEvent(trigger, reason) ? nextIdentity : null;
}

export function ChatInputSurfaceHost(props: ChatInputSurfaceHostProps) {
  const {
    children,
    inputSurface,
    onInputSurfaceTriggerChange,
    onSelectItem,
    triggerSpecs = [CHAT_INPUT_SURFACE_SLASH_TRIGGER_SPEC],
  } = props;
  const menuRef = useRef<ChatInputSurfaceMenuHandle | null>(null);
  const [activeTriggerIdentity, setActiveTriggerIdentity] = useState<string | null>(null);
  const isOpen = Boolean(inputSurface) && activeTriggerIdentity !== null;

  const setActiveTrigger = useCallback(
    (identity: string | null, trigger: ChatInputSurfaceTrigger | null): void => {
      setActiveTriggerIdentity(identity);
      onInputSurfaceTriggerChange?.(identity ? trigger : null);
    },
    [onInputSurfaceTriggerChange],
  );

  const closeInputSurface = useCallback(
    (): void => {
      setActiveTrigger(null, null);
    },
    [setActiveTrigger],
  );

  const handleInputSurfaceSnapshotChange = useCallback(
    (
      nodes: ChatComposerNode[],
      selection: ChatComposerSelection | null,
      reason: ChatInputSurfaceTriggerChangeReason,
    ): void => {
      const trigger = resolveChatComposerActiveInputSurfaceTrigger(nodes, selection, triggerSpecs);
      const nextIdentity = resolveInputSurfaceTriggerIdentity(
        activeTriggerIdentity,
        trigger,
        reason,
      );
      setActiveTrigger(nextIdentity, nextIdentity ? trigger : null);
    },
    [activeTriggerIdentity, setActiveTrigger, triggerSpecs],
  );

  const handleInputSurfaceKeyDown = useCallback((event: KeyboardEvent): boolean => {
    return menuRef.current?.handleKeyDown(event) ?? false;
  }, []);

  const handleInputSurfaceOpenChange = useCallback(
    (open: boolean): void => {
      if (!open) {
        closeInputSurface();
      }
    },
    [closeInputSurface],
  );

  const bindings = useMemo(
    () => ({
      onInputSurfaceKeyDown: handleInputSurfaceKeyDown,
      onInputSurfaceOpenChange: handleInputSurfaceOpenChange,
      onInputSurfaceSnapshotChange: handleInputSurfaceSnapshotChange,
    }),
    [
      handleInputSurfaceKeyDown,
      handleInputSurfaceOpenChange,
      handleInputSurfaceSnapshotChange,
    ],
  );

  return (
    <>
      {/* eslint-disable-next-line react-hooks/refs -- menu ref is read later from keydown handlers, not during render. */}
      {children(bindings)}
      {inputSurface && isOpen ? (
        <ChatInputSurfaceMenu
          key={activeTriggerIdentity}
          ref={menuRef}
          isOpen={isOpen}
          isLoading={inputSurface.isLoading}
          filterOptions={inputSurface.filterOptions}
          items={inputSurface.items}
          texts={inputSurface.texts}
          onSelectItem={(item) => {
            closeInputSurface();
            onSelectItem(item);
          }}
          onOpenChange={handleInputSurfaceOpenChange}
          onDetailsPointerDown={(event) => event.preventDefault()}
        />
      ) : null}
    </>
  );
}
