import { type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "./button";

const markdownPlugins = [remarkGfm];
const markdownComponents = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => href && /^https?:\/\//i.test(href)
    ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    : <span>{children}</span>,
  img: ({ alt }: { alt?: string }) => <span>{alt ?? ""}</span>,
  table: ({ children }: { children?: React.ReactNode }) => <div className="ui-message__table"><table>{children}</table></div>,
};

export function Markdown({ text }: { text: string }) {
  return <ReactMarkdown remarkPlugins={markdownPlugins} skipHtml components={markdownComponents}>{text}</ReactMarkdown>;
}

type MessageProps = {
  role: "user" | "assistant";
  text: string;
  pending?: boolean;
  label: string;
  mark?: ReactNode;
  copyLabel?: string;
  waitingLabel?: string;
  onCopy?: () => void;
};

export function Message({ role, text, pending = false, label, mark, copyLabel, waitingLabel, onCopy }: MessageProps) {
  return <article className={`ui-message ui-message--${role}${pending ? " ui-message--pending" : ""}`}>
    <div className="ui-message__meta">{role === "assistant" && mark && <span className="ui-message__mark" aria-hidden="true">{mark}</span>}{label}</div>
    <div className="ui-message__body">
      {role === "assistant"
        ? text
          ? <Markdown text={text} />
          : pending ? <span className="ui-message__waiting">{waitingLabel}</span> : null
        : text}
    </div>
    {role === "assistant" && !pending && onCopy && copyLabel && <div className="ui-message__actions">
      <Button onClick={onCopy}>{copyLabel}</Button>
    </div>}
  </article>;
}
