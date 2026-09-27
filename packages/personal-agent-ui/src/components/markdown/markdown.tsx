import { Children, isValidElement, useEffect, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { MarkdownCodeBlock } from "./code-block";

const markdownPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex];

export type MarkdownLabels = {
  copyCode: string;
  copiedCode: string;
  copyFailed: string;
  viewSource: string;
  viewDiagram: string;
  diagramLoading: string;
  diagramError: string;
  diagramAlt: string;
  imageAlt: string;
};

const defaultLabels: MarkdownLabels = {
  copyCode: "复制代码", copiedCode: "已复制代码", copyFailed: "复制失败，重试",
  viewSource: "查看源码", viewDiagram: "查看图表", diagramLoading: "正在绘制图表…",
  diagramError: "无法预览图表，原始内容仍可复制。", diagramAlt: "Mermaid 图表", imageAlt: "图片",
};

function nodeText(value: ReactNode): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(nodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(value)) return nodeText(value.props.children);
  return "";
}

function MarkdownImage({ src, alt = "", title, imageAlt }: { src?: string; alt?: string; title?: string; imageAlt: string }) {
  const safeSource = src && /^https:\/\//i.test(src) ? src : null;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [safeSource]);
  if (!safeSource || failed) return <span className="ui-markdown__image-fallback">{alt || imageAlt}</span>;
  return <img src={safeSource} alt={alt} title={title} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

function componentsFor(labels: MarkdownLabels): Components {
  return {
  a: ({ href, children }) => href && /^(https?:\/\/|mailto:)/i.test(href)
    ? <a href={href} target={/^https?:\/\//i.test(href) ? "_blank" : undefined} rel="noopener noreferrer">{children}</a>
    : <span>{children}</span>,
  img: ({ src, alt, title }) => <MarkdownImage src={src} alt={alt} title={title} imageAlt={labels.imageAlt} />,
  table: ({ children }) => <div className="ui-message__table"><table>{children}</table></div>,
  pre: ({ children }) => {
    const code = Children.toArray(children).find((child) => isValidElement(child));
    if (!isValidElement<{ className?: string; children?: ReactNode }>(code)) return <pre>{children}</pre>;
    const language = /language-([^\s]+)/i.exec(code.props.className ?? "")?.[1];
    return <MarkdownCodeBlock code={nodeText(code.props.children)} language={language} labels={labels} />;
  },
  };
}

export function Markdown({ text, labels = defaultLabels, density = "default" }: { text: string; labels?: MarkdownLabels; density?: "default" | "compact" }) {
  const components = useMemo(() => componentsFor(labels), [labels]);
  return <div className={`ui-markdown${density === "compact" ? " ui-markdown--compact" : ""}`}><ReactMarkdown remarkPlugins={markdownPlugins} rehypePlugins={rehypePlugins} skipHtml components={components}>{text}</ReactMarkdown></div>;
}
