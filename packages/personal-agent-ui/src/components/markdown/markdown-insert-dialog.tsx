import { useState } from "react";
import { Dialog } from "../overlays/overlay";
import { Button } from "../button";
import type { MarkdownEditorLabels, MarkdownInspector } from "../../types/markdown-editor.types";

export function MarkdownInsertDialog({ inspector, labels, onClose, onApply }: { inspector: MarkdownInspector; labels: MarkdownEditorLabels; onClose: () => void; onApply: (value: string) => void }) {
  const [value, setValue] = useState(inspector.value);
  const [error, setError] = useState(false);
  const math = inspector.kind === "math";
  const apply = () => {
    const text = value.trim();
    const safe = math ? text.length > 0 : inspector.kind === "image" ? /^https:\/\//i.test(text) : !text || /^(https?:\/\/|mailto:|tel:|#|\/|nextclaw:\/\/)/i.test(text);
    if (!safe) { setError(true); return; }
    onApply(text); onClose();
  };
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} title={labels.rich[inspector.kind]} closeLabel={labels.rich.close}>
    <form className="ui-markdown-insert-form" onSubmit={(event) => { event.preventDefault(); apply(); }}>
      <label>{math ? labels.rich.math : labels.rich.url}
        {math ? <textarea rows={4} value={value} onChange={(event) => setValue(event.target.value)} /> : <input type="text" value={value} onChange={(event) => setValue(event.target.value)} placeholder="https://" />}
      </label>
      {error && <p role="alert">{labels.rich.imageError}</p>}
      <div className="ui-overlay__actions"><Button onClick={onClose}>{labels.rich.close}</Button><Button type="submit" tone="primary">{labels.rich.confirm}</Button></div>
    </form>
  </Dialog>;
}
