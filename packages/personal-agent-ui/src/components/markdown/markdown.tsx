import { lazy, Suspense } from "react";
import "../../styles/markdown-document.css";

const MarkdownRenderer = lazy(() => import("./reading/markdown-renderer"));

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

export type MarkdownProps = {
  text: string; labels?: MarkdownLabels; isStreaming?: boolean; role?: "user" | "assistant"; resolveResourceHref?: (uri: string) => string | null; document?: boolean;
};

export function Markdown({ text, labels = defaultLabels, isStreaming = false, role = "assistant", resolveResourceHref, document = false }: MarkdownProps) {
  return <div className={`ui-markdown${document ? " ui-markdown-document" : ""}`}>
    <Suspense fallback={<div aria-busy="true" style={{ whiteSpace: "pre-wrap" }}>{text}</div>}>
      <MarkdownRenderer text={text} labels={labels} role={role} isStreaming={isStreaming} document={document} resolveResourceHref={resolveResourceHref} />
    </Suspense>
  </div>;
}
