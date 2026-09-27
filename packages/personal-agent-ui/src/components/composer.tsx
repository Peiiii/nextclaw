import { useImperativeHandle, useLayoutEffect, useRef, type KeyboardEvent, type Ref } from "react";
import { ArrowUp, LoaderCircle, Square } from "lucide-react";
import { IconButton } from "./icon-button";

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  canStop: boolean;
  placeholder: string;
  sendLabel: string;
  stopLabel: string;
  busyLabel: string;
  readOnly?: boolean;
  inputRef?: Ref<HTMLTextAreaElement>;
};

export function Composer({ value, onChange, onSend, onStop, busy, canStop, placeholder, sendLabel, stopLabel, busyLabel, readOnly = false, inputRef }: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(inputRef, () => textareaRef.current!);
  useLayoutEffect(() => {
    const input = textareaRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(168, Math.max(48, input.scrollHeight))}px`;
  }, [value]);
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!busy && value.trim()) onSend();
    }
  };
  const label = canStop ? stopLabel : busy ? busyLabel : sendLabel;
  return <div className="ui-composer" role="group" aria-label={sendLabel}>
    <textarea ref={textareaRef} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown}
      maxLength={4000} rows={2} readOnly={readOnly} placeholder={placeholder} aria-label={placeholder} />
    <div className="ui-composer__bottom"><span className="ui-composer__phase" aria-hidden="true">{busy && !canStop ? busyLabel : ""}</span><div className="ui-composer__actions">
      <IconButton className="ui-composer__action" label={label} onClick={canStop ? onStop : onSend}
        disabled={!canStop && (busy || !value.trim())}
        icon={canStop ? <Square size={14} className="ui-composer__stop" fill="currentColor" /> : busy ? <LoaderCircle size={18} className="ui-composer__spinner" /> : <ArrowUp size={20} />} />
      {busy && <span className="ui-sr-only" role="status">{label}</span>}
    </div></div>
  </div>;
}
