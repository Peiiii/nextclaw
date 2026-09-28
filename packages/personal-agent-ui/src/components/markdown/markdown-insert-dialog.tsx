import { useMemo, useState } from "react";
import katex from "katex";
import { Dialog } from "../overlays/overlay";
import { AnchoredPopover } from "../overlays/popover";
import { Button } from "../button";
import type { MarkdownEditorLabels, MarkdownInspector } from "../../types/markdown-editor.types";

export function MarkdownInsertDialog({ inspector, labels, onClose, onApply, onReturnFocus }: { inspector: MarkdownInspector; labels: MarkdownEditorLabels; onClose: () => void; onApply: (value: string) => void; onReturnFocus: () => void }) {
  const [value, setValue] = useState(inspector.value);
  const [error, setError] = useState(false);
  const math = inspector.kind === "math";
  const title = math ? inspector.inline ? labels.rich.inlineMath : labels.rich.blockMath : labels.rich[inspector.kind];
  const rendered = useMemo(() => math ? katex.renderToString(value, { throwOnError: false, displayMode: !inspector.inline, trust: false }) : "", [math, value, inspector.inline]);
  const apply = () => {
    const text = value.trim();
    const safe = math ? text.length > 0 : inspector.kind === "image" ? /^https:\/\//i.test(text) : !text || /^(https?:\/\/|mailto:|tel:|#|\/|nextclaw:\/\/)/i.test(text);
    if (!safe) { setError(true); return; }
    onApply(text); onClose();
  };
  const form = <form className="ui-markdown-insert-form" onSubmit={(event) => { event.preventDefault(); apply(); }}
    onKeyDown={event => { if (math && event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); apply(); } }}>
      <label>{math ? title : labels.rich.url}
        {math ? <textarea rows={4} value={value} onChange={(event) => setValue(event.target.value)} /> : <input type="text" value={value} onChange={(event) => setValue(event.target.value)} placeholder="https://" />}
      </label>
      {math && <div className="ui-markdown-math-hint"><span>{labels.rich.mathHint}</span>{!value.trim() && <Button tone="text" onClick={() => setValue("\\begin{aligned}\na &= b + c \\\\\nd &= e + f\n\\end{aligned}")}>{labels.rich.mathExample}</Button>}</div>}
      {math && <div className="ui-markdown-math-preview" aria-label={labels.rich.preview} dangerouslySetInnerHTML={{ __html: rendered }} />}
      {error && <p role="alert">{math ? labels.rich.error : labels.rich.imageError}</p>}
      <div className="ui-overlay__actions">
        {inspector.kind === "link" && inspector.value && <Button onClick={() => { onApply(""); onClose(); }}>{labels.rich.unlink}</Button>}
        <Button onClick={onClose}>{labels.rich.close}</Button><Button type="submit" tone="primary">{labels.rich.confirm}</Button>
      </div>
    </form>;
  return inspector.kind !== "image" && inspector.anchor
    ? <AnchoredPopover anchor={inspector.anchor} label={title} onClose={onClose} onReturnFocus={onReturnFocus}>{form}</AnchoredPopover>
    : <Dialog open onOpenChange={open => { if (!open) onClose(); }} title={title} closeLabel={labels.rich.close}>{form}</Dialog>;
}
