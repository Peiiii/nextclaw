import { lazy, Suspense, useState } from "react";
import "../../styles/markdown-editor.css";
import type { MarkdownEditorProps } from "../../types/markdown-editor.types";
export type { MarkdownEditorLabels } from "../../types/markdown-editor.types";

const RichMarkdownEditor = lazy(() => import("./rich-markdown-editor").then((module) => ({ default: module.RichMarkdownEditor })));
const SourceMarkdownEditor = lazy(() => import("./source-markdown-editor").then((module) => ({ default: module.SourceMarkdownEditor })));

export function MarkdownEditor(props: MarkdownEditorProps) {
  const [opened, setOpened] = useState({ rich: !props.source, source: props.source });
  if (props.source && !opened.source) setOpened({ ...opened, source: true });
  if (!props.source && !opened.rich) setOpened({ ...opened, rich: true });
  const modeClass = `ui-markdown-mode${props.layout === "embedded" ? " ui-markdown-mode--embedded" : ""}`;
  return <>
    {opened.rich && <div className={modeClass} hidden={props.source}>
      <Suspense fallback={<div className="ui-markdown-editor-loading" role="status">{props.labels.rich.loading}</div>}><RichMarkdownEditor {...props} active={props.active !== false && !props.source} /></Suspense>
    </div>}
    {opened.source && <div className={modeClass} hidden={!props.source}><Suspense fallback={<div className="ui-markdown-editor-loading" role="status">{props.labels.rich.loading}</div>}><SourceMarkdownEditor {...props} active={props.active !== false && props.source} /></Suspense></div>}
  </>;
}
