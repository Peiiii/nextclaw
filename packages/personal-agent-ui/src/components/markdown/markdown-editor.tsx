import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Button } from "../button";
import "../../styles/markdown-editor.css";
import type { MarkdownEditorProps } from "../../types/markdown-editor.types";
export type { MarkdownEditorLabels } from "../../types/markdown-editor.types";

const loadRichMarkdownEditor = () => import("./rich-markdown-editor").then((module) => ({ default: module.RichMarkdownEditor }));
const RichMarkdownEditor = lazy(loadRichMarkdownEditor);
const SourceMarkdownEditor = lazy(() => import("./source-markdown-editor").then((module) => ({ default: module.SourceMarkdownEditor })));

/** Start the same lazy import while the host is fetching a requested document. */
export const preloadMarkdownEditor = (): Promise<void> => loadRichMarkdownEditor().then(() => undefined);

type EditorLoadProps = { labels: MarkdownEditorProps["labels"]["rich"]; onRetry?: () => void };

function MarkdownEditorLoading({ labels, onRetry }: EditorLoadProps) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 12_000);
    return () => clearTimeout(timer);
  }, []);
  return <div className="ui-markdown-editor-loading" role="status">
    <span>{slow ? labels.loadSlow : labels.loading}</span>
    {slow && onRetry && <Button tone="secondary" onClick={onRetry}>{labels.reload}</Button>}
  </div>;
}

class MarkdownEditorLoadBoundary extends Component<EditorLoadProps & { children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError = () => ({ failed: true });
  render = () => this.state.failed
    ? <div className="ui-markdown-editor-loading" role="alert"><span>{this.props.labels.loadError}</span>{this.props.onRetry && <Button tone="secondary" onClick={this.props.onRetry}>{this.props.labels.reload}</Button>}</div>
    : <Suspense fallback={<MarkdownEditorLoading labels={this.props.labels} onRetry={this.props.onRetry} />}>{this.props.children}</Suspense>;
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  const [opened, setOpened] = useState({ rich: !props.source, source: props.source });
  if (props.source && !opened.source) setOpened({ ...opened, source: true });
  if (!props.source && !opened.rich) setOpened({ ...opened, rich: true });
  const modeClass = `ui-markdown-mode${props.layout === "embedded" ? " ui-markdown-mode--embedded" : ""}`;
  return <>
    {opened.rich && <div className={modeClass} hidden={props.source}>
      <MarkdownEditorLoadBoundary labels={props.labels.rich} onRetry={props.onLoadRetry}><RichMarkdownEditor {...props} active={props.active !== false && !props.source} /></MarkdownEditorLoadBoundary>
    </div>}
    {opened.source && <div className={modeClass} hidden={!props.source}><MarkdownEditorLoadBoundary labels={props.labels.rich} onRetry={props.onLoadRetry}><SourceMarkdownEditor {...props} active={props.active !== false && props.source} /></MarkdownEditorLoadBoundary></div>}
  </>;
}
