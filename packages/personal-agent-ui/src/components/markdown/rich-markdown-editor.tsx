import { useEffect, useRef, useState } from "react";
import { MarkdownEditorManager } from "../../managers/markdown-editor.manager";
import { MarkdownEditorToolbar } from "./markdown-editor-toolbar";
import { MarkdownInsertDialog } from "./markdown-insert-dialog";
import { Button } from "../button";
import type { MarkdownEditorProps, MarkdownSelection, MarkdownInspector } from "../../types/markdown-editor.types";
import "katex/dist/katex.min.css";
import "../../styles/rich-markdown-editor.css";

export function RichMarkdownEditor(props: MarkdownEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const manager = useRef<MarkdownEditorManager>();
  const current = useRef(props);
  current.current = props;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [inspector, setInspector] = useState<MarkdownInspector | null>(null);
  const [selection, setSelection] = useState<MarkdownSelection>({ bold: false, italic: false, heading: 0, undo: false, redo: false, table: false });
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const text = props.labels.rich;
  useEffect(() => {
    let cancelled = false;
    const editor = new MarkdownEditorManager(current.current, (state) => { if (!cancelled) setSelection(state); }, () => setSearching(true), setInspector);
    manager.current = editor;
    try { editor.mount(host.current!); setReady(true); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    return () => { cancelled = true; manager.current = undefined; editor.destroy(); };
  }, []);
  useEffect(() => { manager.current?.update(props); }, [props]);
  useEffect(() => { manager.current?.search(searching ? query : "", replacement); }, [searching, query, replacement]);
  useEffect(() => {
    if (!props.active || !ready) return;
    const frame = requestAnimationFrame(() => { const element = scroller.current; if (element) element.scrollTop = (current.current.scrollProgress ?? 0) * Math.max(0, element.scrollHeight - element.clientHeight); });
    return () => cancelAnimationFrame(frame);
  }, [props.active, ready]);
  return <div className="ui-markdown-editor ui-rich-markdown-editor">
    <MarkdownEditorToolbar labels={props.labels} selection={selection} manager={ready ? manager.current : undefined} onSearch={() => setSearching((value) => !value)} />
    {searching && <div className="ui-markdown-search" role="search" onKeyDown={(event) => { if (event.key === "Escape") { setSearching(false); manager.current?.focus(); } }}>
      <input autoFocus aria-label={text.find} placeholder={text.find} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); manager.current?.searchAction(event.shiftKey ? "previous" : "next"); } }} />
      <input aria-label={text.replace} placeholder={text.replace} value={replacement} onChange={(event) => setReplacement(event.target.value)} />
      {(["previous", "next", "replace", "all"] as const).map((action) => <Button key={action} tone="text" onClick={() => manager.current?.searchAction(action)}>{action === "all" ? text.replaceAll : text[action]}</Button>)}
      <Button tone="text" onClick={() => { setSearching(false); manager.current?.focus(); }}>{text.close}</Button>
    </div>}
    {error ? <div role="alert">{text.error} {error}</div> : !ready && <div role="status">{text.loading}</div>}
    <div className="ui-rich-markdown-scroll" ref={scroller} onScroll={(event) => { if (props.active) { const element = event.currentTarget; props.onScrollProgress?.(element.scrollTop / Math.max(1, element.scrollHeight - element.clientHeight)); } }}>
      <div className="ui-rich-markdown-host" ref={host} />
    </div>
    {inspector && <MarkdownInsertDialog inspector={inspector} labels={props.labels} onClose={() => setInspector(null)} onApply={(value) => manager.current?.applyInspector(inspector, value)} />}
  </div>;
}
