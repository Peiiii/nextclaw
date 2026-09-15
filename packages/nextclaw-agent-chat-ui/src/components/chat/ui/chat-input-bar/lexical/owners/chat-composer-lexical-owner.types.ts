import type {
  ChatComposerNode,
  ChatComposerSelection,
  ChatInputSurfaceItem,
  ChatInputSurfaceTriggerChangeReason,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

export type ChatComposerLexicalOwnerCallbacks = {
  onInputSurfaceItemSelect?: (item: ChatInputSurfaceItem) => void;
  onInputSurfaceKeyDown?: (event: KeyboardEvent) => boolean;
  onInputSurfaceOpenChange?: (open: boolean) => void;
  onInputSurfaceSnapshotChange?: (
    nodes: ChatComposerNode[],
    selection: ChatComposerSelection | null,
    reason: ChatInputSurfaceTriggerChangeReason,
  ) => void;
  onNodesChange: (nodes: ChatComposerNode[]) => void;
};
