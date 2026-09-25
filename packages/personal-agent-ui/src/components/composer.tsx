import type { KeyboardEvent, Ref } from "react";
import { Button } from "./button";

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
  hint: string;
  inputRef?: Ref<HTMLTextAreaElement>;
};

export function Composer({ value, onChange, onSend, onStop, busy, canStop, placeholder, sendLabel, stopLabel, hint, inputRef }: ComposerProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!busy && value.trim()) onSend();
    }
  };
  return <div className="ui-composer" role="group" aria-label={sendLabel}>
    <textarea ref={inputRef} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown}
      maxLength={4000} rows={2} disabled={busy} placeholder={placeholder} aria-label={placeholder} />
    <div className="ui-composer__bottom"><span>{hint}</span><div className="ui-composer__actions">
      {canStop && <Button tone="danger" onClick={onStop}>{stopLabel}</Button>}
      <Button tone="primary" onClick={onSend} disabled={busy || !value.trim()} aria-label={sendLabel} title={sendLabel}>↑</Button>
    </div></div>
  </div>;
}
