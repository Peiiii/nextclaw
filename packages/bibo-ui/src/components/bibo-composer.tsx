import type { KeyboardEvent, Ref } from "react";
import { BiboButton } from "./bibo-button";

type BiboComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  canStop: boolean;
  placeholder: string;
  sendLabel: string;
  stopLabel: string;
  hint: string;
  inputRef?: Ref<HTMLTextAreaElement>;
};

export function BiboComposer({ value, onChange, onSend, onStop, busy, canStop, placeholder, sendLabel, stopLabel, hint, inputRef }: BiboComposerProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!busy && value.trim()) onSend();
    }
  };
  return <div className="bibo-composer" role="group" aria-label={sendLabel}>
    <textarea ref={inputRef} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown}
      maxLength={4000} rows={2} disabled={busy} placeholder={placeholder} aria-label={placeholder} />
    <div className="bibo-composer__bottom"><span>{hint}</span><div className="bibo-composer__actions">
      {canStop && <BiboButton tone="danger" onClick={onStop}>{stopLabel}</BiboButton>}
      <BiboButton tone="primary" onClick={onSend} disabled={busy || !value.trim()} aria-label={sendLabel} title={sendLabel}>↑</BiboButton>
    </div></div>
  </div>;
}
