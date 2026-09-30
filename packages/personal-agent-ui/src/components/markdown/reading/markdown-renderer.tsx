import { ChatMessageMarkdown, type ChatMessageTexts } from "@nextclaw/agent-chat-ui";
import { useCallback, useMemo } from "react";
import { MarkdownCodeBlock } from "./code-block";
import type { MarkdownLabels, MarkdownProps } from "../markdown";

const hostedUrl = (url: string, key: string) =>
  (key === "src" ? /^(https:\/\/|\/(?!\/))/i.test(url) : /^(https?:\/\/|mailto:|tel:|#)/i.test(url)) ? url : "";

export default function MarkdownRenderer({ text, labels, isStreaming, role, resolveResourceHref, document }: MarkdownProps & { labels: MarkdownLabels; role: "user" | "assistant" }) {
  const texts = useMemo(() => ({
    copyCodeLabel: labels.copyCode, copiedCodeLabel: labels.copiedCode,
    frontmatterLabel: "文档属性", detailsLabel: "详情",
    mermaidDiagramLabel: labels.diagramAlt, mermaidLoadingLabel: labels.diagramLoading,
    mermaidRenderErrorLabel: labels.diagramError, mermaidExpandLabel: labels.expandDiagram,
    attachmentExpandLabel: labels.expandImage, attachmentCloseLabel: labels.closePreview,
    previewZoomInLabel: labels.zoomIn, previewZoomOutLabel: labels.zoomOut, previewResetZoomLabel: labels.resetZoom,
    footnoteLabel: labels.footnotes, footnoteBackLabel: labels.backToReference, imageAltLabel: labels.imageAlt,
  } satisfies Partial<ChatMessageTexts>), [labels]);
  const renderCodeBlock = useCallback(({ source, language, isStreaming: streaming }: { source: string; language: string; isStreaming: boolean }) =>
    <MarkdownCodeBlock code={source} language={language} labels={labels} texts={texts} isStreaming={streaming} />, [labels, texts]);
  return <ChatMessageMarkdown text={text} role={role} texts={texts} isStreaming={isStreaming}
    allowHtml={document} urlTransform={(uri, key) => hostedUrl(uri, key) || (key === "href" ? resolveResourceHref?.(uri) ?? "" : "")} renderCodeBlock={renderCodeBlock} />;
}
