import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useState,
} from 'react';
import type { ChatComposerNode, ChatInputBarActionsProps, ChatSkillPickerOption, ChatSlashItem } from '../../view-models/chat-ui.types';
import { ChatComposerRuntime } from './chat-composer-runtime';

export type ChatInputBarTokenizedComposerHandle = {
  insertSlashItem: (item: ChatSlashItem) => void;
  insertFileToken: (tokenKey: string, label: string) => void;
  insertFileTokens: (tokens: Array<{ tokenKey: string; label: string }>) => void;
  focusComposer: () => void;
  syncSelectedSkills: (nextKeys: string[], options: ChatSkillPickerOption[]) => void;
};

type ChatInputBarTokenizedComposerProps = {
  nodes: ChatComposerNode[];
  placeholder: string;
  disabled: boolean;
  slashItems: ChatSlashItem[];
  actions: Pick<ChatInputBarActionsProps, 'onSend' | 'onStop' | 'isSending' | 'canStopGeneration'>;
  onNodesChange: (nodes: ChatComposerNode[]) => void;
  onFilesAdd?: (files: File[]) => Promise<void> | void;
  onSlashQueryChange?: (query: string | null) => void;
  onSlashTriggerChange?: (trigger: { query: string; start: number; end: number } | null) => void;
  onSlashOpenChange: (open: boolean) => void;
  onSlashActiveIndexChange: (index: number) => void;
  activeSlashIndex: number;
};

export const ChatInputBarTokenizedComposer = forwardRef<
  ChatInputBarTokenizedComposerHandle,
  ChatInputBarTokenizedComposerProps
>(function ChatInputBarTokenizedComposer(props, ref) {
  const {
    nodes,
    placeholder,
    disabled,
    slashItems,
    actions,
    onNodesChange,
    onFilesAdd,
    onSlashQueryChange,
    onSlashTriggerChange,
    onSlashOpenChange,
    onSlashActiveIndexChange,
    activeSlashIndex
  } = props;
  const [renderTick, setRenderTick] = useState(0);
  const [runtime] = useState(() => new ChatComposerRuntime());
  const {
    snapshot,
    bindRootElement,
    handleBeforeInput,
    handleInput,
    handleCompositionStart,
    handleCompositionEnd,
    handleKeyDown,
    handlePaste,
    handleBlur,
    syncSelectionState,
    imperativeHandle
  } = runtime.update({
    nodes,
    disabled,
    slashItems,
    actions,
    onNodesChange,
    onFilesAdd,
    onSlashQueryChange,
    onSlashTriggerChange,
    onSlashOpenChange,
    onSlashActiveIndexChange,
    activeSlashIndex,
    requestRender: () => setRenderTick((value) => value + 1)
  });
  void renderTick;

  useImperativeHandle(ref, () => imperativeHandle, [imperativeHandle]);

  useLayoutEffect(() => {
    runtime.renderSurface();
    runtime.restoreDomAfterCommit();
    runtime.syncViewport();
  }, [runtime, snapshot.nodes, snapshot.nodeStartMap, renderTick]);

  return (
    <div className="px-4 py-2.5">
      <div className="min-h-[60px]">
        <div
          ref={bindRootElement}
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          data-placeholder={placeholder}
          onBeforeInput={handleBeforeInput}
          onInput={handleInput}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onKeyDown={handleKeyDown}
          onKeyUp={syncSelectionState}
          onMouseUp={syncSelectionState}
          onFocus={syncSelectionState}
          onBlur={handleBlur}
          onPaste={handlePaste}
          className="min-h-7 max-h-[188px] w-full overflow-y-auto whitespace-pre-wrap break-words bg-transparent py-0.5 text-sm leading-6 text-gray-800 outline-none empty:before:pointer-events-none empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)]"
        />
      </div>
    </div>
  );
});
