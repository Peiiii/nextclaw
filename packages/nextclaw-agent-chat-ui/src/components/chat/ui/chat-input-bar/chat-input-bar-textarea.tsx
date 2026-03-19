import { useLayoutEffect, useRef } from 'react';
import type { KeyboardEventHandler } from 'react';
import { Puzzle } from 'lucide-react';
import type { ChatSelectedItem } from '../../view-models/chat-ui.types';

const CHAT_INPUT_MAX_HEIGHT = 188;

type ChatInputBarTextareaProps = {
  value: string;
  placeholder: string;
  disabled: boolean;
  selectedItems: ChatSelectedItem[];
  onRemoveSelectedItem: (key: string) => void;
  onValueChange: (value: string) => void;
  onKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
};

export function ChatInputBarTextarea(props: ChatInputBarTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) {
      return;
    }

    element.style.height = '0px';
    const nextHeight = Math.min(element.scrollHeight, CHAT_INPUT_MAX_HEIGHT);
    element.style.height = `${Math.max(nextHeight, 28)}px`;
    element.style.overflowY = element.scrollHeight > CHAT_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
  }, [props.value, props.selectedItems]);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    const hasSelectedSkills = props.selectedItems.length > 0;
    const isPlainBackspace = event.key === 'Backspace' && !event.metaKey && !event.ctrlKey && !event.altKey;
    const isDraftEmpty = props.value.length === 0;

    if (hasSelectedSkills && isPlainBackspace && isDraftEmpty && !event.nativeEvent.isComposing) {
      event.preventDefault();
      const lastSelectedItem = props.selectedItems[props.selectedItems.length - 1];
      if (lastSelectedItem) {
        props.onRemoveSelectedItem(lastSelectedItem.key);
      }
      return;
    }

    props.onKeyDown(event);
  };

  return (
    <div className="px-4 py-2.5">
      <div className="flex min-h-[60px] flex-wrap items-start gap-1.5">
        {props.selectedItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => props.onRemoveSelectedItem(item.key)}
            className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-lg border border-primary/12 bg-primary/8 px-2 text-[11px] font-medium text-primary transition hover:bg-primary/12"
          >
            <Puzzle aria-hidden className="h-3.5 w-3.5 shrink-0 text-primary/70" />
            <span className="truncate">{item.label}</span>
          </button>
        ))}

        <textarea
          ref={textareaRef}
          value={props.value}
          onChange={(event) => props.onValueChange(event.target.value)}
          disabled={props.disabled}
          onKeyDown={handleKeyDown}
          placeholder={props.placeholder}
          rows={1}
          className="min-h-7 max-h-[188px] min-w-[220px] flex-1 basis-[240px] resize-none self-stretch bg-transparent py-0.5 text-sm leading-6 text-gray-800 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}
