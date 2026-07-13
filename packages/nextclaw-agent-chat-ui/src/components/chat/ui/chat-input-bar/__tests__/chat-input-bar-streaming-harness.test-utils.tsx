import { useCallback, useEffect, useState, type MutableRefObject } from 'react';
import { vi } from 'vitest';
import {
  ChatInputBar,
} from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-input-bar';
import {
  createChatComposerTextNode,
} from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-composer.utils';
import type {
  ChatComposerNode,
  ChatInputBarProps,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

export type DeferredComposerOwnerHarnessControl = {
  bumpStream: () => void;
  flushNodes: () => void;
};

function createStreamingInputBarProps(params: {
  nodes: ChatComposerNode[];
  onNodesChange: (nodes: ChatComposerNode[]) => void;
}): ChatInputBarProps {
  const { nodes, onNodesChange } = params;
  return {
    composer: {
      nodes,
      placeholder: 'Type a message',
      disabled: false,
      onNodesChange,
    },
    hint: null,
    toolbar: {
      selects: [],
      actions: {
        isSending: true,
        canStopGeneration: true,
        sendDisabled: false,
        stopDisabled: false,
        stopHint: 'Stop unavailable',
        sendButtonLabel: 'Send',
        stopButtonLabel: 'Stop',
        onSend: vi.fn(),
        onStop: vi.fn(),
      },
    },
  };
}

export function DeferredComposerOwnerHarness({
  controlRef,
}: {
  controlRef: MutableRefObject<DeferredComposerOwnerHarnessControl | null>;
}) {
  const [nodes, setNodes] = useState<ChatComposerNode[]>([createChatComposerTextNode('')]);
  const [pendingNodes, setPendingNodes] = useState<ChatComposerNode[] | null>(null);
  const [, setStreamVersion] = useState(0);
  const bumpStream = useCallback(() => setStreamVersion((version) => version + 1), []);
  const flushNodes = useCallback(() => {
    if (pendingNodes) {
      setNodes(pendingNodes);
    }
  }, [pendingNodes]);

  useEffect(() => {
    controlRef.current = {
      bumpStream,
      flushNodes,
    };
    return () => {
      controlRef.current = null;
    };
  }, [bumpStream, controlRef, flushNodes]);

  return (
    <ChatInputBar
      {...createStreamingInputBarProps({
        nodes,
        onNodesChange: setPendingNodes,
      })}
    />
  );
}

export function StreamingComposerHarness({
  controlRef,
}: {
  controlRef: MutableRefObject<{ bumpStream: () => void } | null>;
}) {
  const [nodes, setNodes] = useState<ChatComposerNode[]>([createChatComposerTextNode('')]);
  const [streamChunk, setStreamChunk] = useState(0);
  const bumpStream = useCallback(() => setStreamChunk((chunk) => chunk + 1), []);

  useEffect(() => {
    controlRef.current = { bumpStream };
    return () => {
      controlRef.current = null;
    };
  }, [bumpStream, controlRef]);

  return (
    <>
      <div data-testid="stream-chunk">{streamChunk}</div>
      <ChatInputBar
        {...createStreamingInputBarProps({
          nodes: [...nodes],
          onNodesChange: setNodes,
        })}
      />
    </>
  );
}
