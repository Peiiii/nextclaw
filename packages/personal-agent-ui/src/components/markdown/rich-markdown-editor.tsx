import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { MarkdownEditorManager } from "../../managers/markdown-editor.manager";
import { MarkdownEditorToolbar } from "./markdown-editor-toolbar";
import { MarkdownInsertDialog } from "./markdown-insert-dialog";
import { MarkdownSlashMenu, MarkdownBlockHandle } from "./markdown-context-tools";
import { MarkdownSelectionToolbar } from "./markdown-context-tools";
import type { MarkdownBlockState } from "../../managers/markdown-block.manager";
import { Button } from "../button";
import { IconButton } from "../icon-button";
import type { MarkdownEditorProps, MarkdownSelection, MarkdownInspector, MarkdownSlashState } from "../../types/markdown-editor.types";
import "katex/dist/katex.min.css";
import "../../styles/rich-markdown-editor.css";
import "../../styles/markdown-document.css";

export function RichMarkdownEditor(props: MarkdownEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const manager = useRef<MarkdownEditorManager>();
  const current = useRef(props);
  current.current = props;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [inspector, setInspector] = useState<MarkdownInspector | null>(null);
  if (!props.active && inspector) setInspector(null);
  const [slash, setSlash] = useState<MarkdownSlashState | null>(null);
  const [block, setBlock] = useState<MarkdownBlockState | null>(null);
  const [selection, setSelection] = useState<MarkdownSelection>({ bold: false, italic: false, strike: false, code: false, link: false, heading: 0, undo: false, redo: false, table: false });
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const text = props.labels.rich;
  const didMount = (failure?: string) => { if (failure) setError(failure); else setReady(true); };
  const toolbar = <MarkdownEditorToolbar labels={props.labels} selection={selection} manager={ready ? manager.current : undefined} compact={props.layout !== "embedded"} onSearch={() => setSearching((value) => !value)} />;
  useEffect(() => {
    let cancelled = false;
    const editor = new MarkdownEditorManager(current.current, (state) => { if (!cancelled) setSelection(state); }, () => setSearching(true), setInspector, setSlash, setBlock, failure => { if (!cancelled) didMount(failure); });
    manager.current = editor;
    editor.mount(host.current!);
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
    {props.toolbarContainer ? props.active && createPortal(toolbar, props.toolbarContainer) : toolbar}
    {selection.uploading && <div className="ui-markdown-upload-status" role="status">{text.uploadingImage}</div>}
    {selection.uploadError && <div className="ui-markdown-upload-status" role="alert"><span>{selection.uploadError}</span><IconButton label={text.close} icon={<X />} onClick={() => manager.current?.clearUploadError()} /></div>}
    {searching && <div className="ui-markdown-search" role="search" onKeyDown={(event) => { if (event.key === "Escape") { setSearching(false); manager.current?.focus(); } }}>
      <input autoFocus aria-label={text.find} placeholder={text.find} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); manager.current?.searchAction(event.shiftKey ? "previous" : "next"); } }} />
      <input aria-label={text.replace} placeholder={text.replace} value={replacement} onChange={(event) => setReplacement(event.target.value)} />
      {(["previous", "next", "replace", "all"] as const).map((action) => <Button key={action} tone="text" onClick={() => manager.current?.searchAction(action)}>{action === "all" ? text.replaceAll : text[action]}</Button>)}
      <Button tone="text" onClick={() => { setSearching(false); manager.current?.focus(); }}>{text.close}</Button>
    </div>}
    {error ? <div className="ui-markdown-editor-loading" role="alert">{text.error} {error}</div> : !ready && <div className="ui-markdown-editor-loading" role="status">{text.loading}</div>}
    <div className="ui-rich-markdown-scroll" hidden={!ready || Boolean(error)} ref={scroller} onScroll={(event) => { if (props.active) { const element = event.currentTarget; props.onScrollProgress?.(element.scrollTop / Math.max(1, element.scrollHeight - element.clientHeight)); manager.current?.refreshContext(); } }}>
      <div className="ui-rich-markdown-host" ref={host} />
    </div>
    {props.active && inspector && <MarkdownInsertDialog key={`${inspector.kind}:${inspector.position}:${inspector.value}`} inspector={inspector} labels={props.labels} onClose={() => setInspector(null)} onApply={(value, image) => manager.current?.applyInspector(inspector, value, image)} onReturnFocus={() => manager.current?.focus()} onUpload={props.uploadImage ? (file, image) => void manager.current?.uploadImage(file, image) : undefined} />}
    {props.active && manager.current && slash && <MarkdownSlashMenu state={slash} labels={props.labels} manager={manager.current} />}
    {props.active && manager.current && !inspector && !slash && !block?.open && <MarkdownSelectionToolbar selection={selection} labels={props.labels} manager={manager.current} />}
    {props.active && manager.current && block && <MarkdownBlockHandle state={block} labels={props.labels} manager={manager.current.blocks} onInsert={() => void manager.current?.insertBlock(true)} />}
  </div>;
}
