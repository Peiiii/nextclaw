import { useEffect, useRef, useState } from "react";
import { minimalSetup } from "codemirror";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { Compartment, EditorState, Transaction } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, placeholder } from "@codemirror/view";
import { defaultKeymap, historyKeymap, indentWithTab, undo, redo, undoDepth, redoDepth } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { bracketMatching, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { search, searchKeymap, openSearchPanel } from "@codemirror/search";
import { tags } from "@lezer/highlight";
import { Bold, Italic, Heading2, List, Code, Search, Undo2, Redo2 } from "lucide-react";
import { IconButton } from "../icon-button";
import { ActionMenu, ActionMenuItem } from "../overlays/action-menu";
import { prefixLines, replaceExternalText, wrapSelection } from "../../utils/markdown-editor.utils";
import "../../styles/markdown-editor.css";

const highlight = HighlightStyle.define([
  { tag: [tags.heading, tags.keyword], class: "cm-syntax-keyword" },
  { tag: [tags.string, tags.url], class: "cm-syntax-string" },
  { tag: [tags.number, tags.bool, tags.atom], class: "cm-syntax-number" },
  { tag: [tags.comment, tags.meta], class: "cm-syntax-muted" },
  { tag: tags.strong, fontWeight: "700" }, { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: [tags.monospace, tags.escape], class: "cm-syntax-code" },
]);

import type { MarkdownEditorLabels } from "../../types/markdown-editor.types";

export function SourceMarkdownEditor({ value, onChange, source, label, labels, active = true, scrollProgress = 0, onScrollProgress }: {
  value: string; onChange: (value: string) => void; source: boolean; label: string;
  labels: MarkdownEditorLabels; active?: boolean;
  scrollProgress?: number; onScrollProgress?: (progress: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>();
  const accessibility = useRef(new Compartment());
  const [history, setHistory] = useState({ undo: false, redo: false });
  const current = useRef({ value, onChange, source, label, labels, onScrollProgress, scrollProgress });
  current.current = { value, onChange, source, label, labels, onScrollProgress, scrollProgress };
  useEffect(() => {
    const props = current.current;
    const editor = new EditorView({ parent: host.current!, state: EditorState.create({ doc: props.value, extensions: [
      minimalSetup, EditorView.lineWrapping, bracketMatching(), closeBrackets(), markdown({ codeLanguages: languages }), syntaxHighlighting(highlight),
      search({ top: true }), keymap.of([
        { key: "Mod-b", run: (view) => wrapSelection(view, "**") },
        { key: "Mod-i", run: (view) => wrapSelection(view, "*") },
        ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab,
      ]),
      placeholder(props.labels.placeholder), accessibility.current.of(EditorView.contentAttributes.of({ "aria-label": props.label, "aria-multiline": "true", spellcheck: "false" })),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && update.state.doc.toString() !== current.current.value) current.current.onChange(update.state.doc.toString());
        const undo = undoDepth(update.state) > 0, redo = redoDepth(update.state) > 0;
        setHistory((previous) => previous.undo === undo && previous.redo === redo ? previous : { undo, redo });
      }),
      EditorView.domEventHandlers({ scroll: (_event, view) => {
        const element = view.scrollDOM;
        current.current.onScrollProgress?.(element.scrollTop / Math.max(1, element.scrollHeight - element.clientHeight));
      } }),
      lineNumbers(),
      EditorState.phrases.of(props.labels.phrases),
    ] }) });
    view.current = editor;
    return () => { editor.destroy(); view.current = undefined; };
  }, []);
  useEffect(() => {
    const editor = view.current;
    if (active && editor && editor.state.doc.toString() !== value) editor.dispatch({ changes: replaceExternalText(editor.state, value), annotations: Transaction.addToHistory.of(false) });
  }, [value, active]);
  useEffect(() => {
    if (!active || !view.current) return;
    const editor = view.current;
    const progress = current.current.scrollProgress;
    editor.requestMeasure({ read: () => Math.max(0, editor.scrollDOM.scrollHeight - editor.scrollDOM.clientHeight), write: (height) => { editor.scrollDOM.scrollTop = progress * height; } });
  }, [active]);
  useEffect(() => { view.current?.dispatch({ effects: accessibility.current.reconfigure(EditorView.contentAttributes.of({ "aria-label": label, "aria-multiline": "true", spellcheck: "false" })) }); }, [label]);
  const run = (command: (view: EditorView) => unknown) => { if (view.current) { command(view.current); view.current.focus(); } };
  return <div className="ui-markdown-editor is-source">
    <div className="ui-markdown-editor-toolbar" role="toolbar" aria-label={labels.toolbar}>
      <IconButton label={labels.bold} icon={<Bold />} onClick={() => run((view) => wrapSelection(view, "**"))} />
      <IconButton label={labels.italic} icon={<Italic />} onClick={() => run((view) => wrapSelection(view, "*"))} />
      <div className="ui-markdown-editor-formats">
        <IconButton label={labels.heading} icon={<Heading2 />} onClick={() => run((view) => prefixLines(view, "## "))} />
        <IconButton label={labels.list} icon={<List />} onClick={() => run((view) => prefixLines(view, "- "))} />
        <IconButton label={labels.code} icon={<Code />} onClick={() => run((view) => wrapSelection(view, "`"))} />
      </div>
      <div className="ui-markdown-editor-more"><ActionMenu label={labels.more} transferringFocus>
        <ActionMenuItem onSelect={() => run((view) => prefixLines(view, "## "))}>{labels.heading}</ActionMenuItem>
        <ActionMenuItem onSelect={() => run((view) => prefixLines(view, "- "))}>{labels.list}</ActionMenuItem>
        <ActionMenuItem onSelect={() => run((view) => wrapSelection(view, "`"))}>{labels.code}</ActionMenuItem>
      </ActionMenu></div>
      <span className="ui-markdown-editor-toolbar-space" />
      <IconButton label={labels.undo} disabled={!history.undo} icon={<Undo2 />} onClick={() => run(undo)} />
      <IconButton label={labels.redo} disabled={!history.redo} icon={<Redo2 />} onClick={() => run(redo)} />
      <IconButton label={labels.search} icon={<Search />} onClick={() => { if (view.current) openSearchPanel(view.current); }} />
    </div>
    <div className="ui-markdown-editor-host" ref={host} />
  </div>;
}
