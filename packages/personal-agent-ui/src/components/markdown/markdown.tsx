import { ChatMessageMarkdown, type ChatMessageTexts } from "@nextclaw/agent-chat-ui";
import { useCallback, useMemo } from "react";
import { MarkdownCodeBlock } from "./code-block";

export type MarkdownLabels = {
  copyCode: string; copiedCode: string; copyFailed: string;
  viewSource: string; viewDiagram: string; diagramLoading: string; diagramError: string;
  diagramAlt: string; imageAlt: string;
  expandDiagram?: string; expandImage?: string; closePreview?: string;
  zoomIn?: string; zoomOut?: string; resetZoom?: string;
  footnotes?: string; backToReference?: string;
};

const defaultLabels: MarkdownLabels = {
  copyCode: "复制代码", copiedCode: "已复制代码", copyFailed: "复制失败，重试",
  viewSource: "查看源码", viewDiagram: "查看图表", diagramLoading: "正在绘制图表…",
  diagramError: "无法预览图表，原始内容仍可复制。", diagramAlt: "Mermaid 图表", imageAlt: "图片",
  expandDiagram: "展开图表", expandImage: "展开图片", closePreview: "关闭预览",
  zoomIn: "放大", zoomOut: "缩小", resetZoom: "重置缩放",
  footnotes: "注释", backToReference: "返回正文",
};

// Hosted pages have no local file-content resolver; keep unknown local links inert.
const hostedUrl = (url: string, key: string) =>
  (key === "src" ? /^https:\/\//i.test(url) : /^(https?:\/\/|mailto:|tel:|#)/i.test(url)) ? url : "";

export function Markdown({ text, labels = defaultLabels, density = "default", isStreaming = false, role = "assistant" }: {
  text: string; labels?: MarkdownLabels; density?: "default" | "compact"; isStreaming?: boolean; role?: "user" | "assistant";
}) {
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
  return <div className={`ui-markdown${density === "compact" ? " ui-markdown--compact" : ""}`}>
    <ChatMessageMarkdown text={text} role={role} texts={texts} isStreaming={isStreaming}
      allowHtml={false} urlTransform={hostedUrl} renderCodeBlock={renderCodeBlock} />
  </div>;
}
