import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BiboButton } from "./bibo-button";

const markdownPlugins = [remarkGfm];
const markdownComponents = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => href && /^https?:\/\//i.test(href)
    ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    : <span>{children}</span>,
  img: ({ alt }: { alt?: string }) => <span>{alt ?? "图片"}</span>,
  table: ({ children }: { children?: React.ReactNode }) => <div className="bibo-message__table"><table>{children}</table></div>,
};

type BiboMessageProps = {
  role: "user" | "assistant";
  text: string;
  pending?: boolean;
  label: string;
  copyLabel?: string;
  onCopy?: () => void;
};

export function BiboMessage({ role, text, pending = false, label, copyLabel, onCopy }: BiboMessageProps) {
  return <article className={`bibo-message bibo-message--${role}${pending ? " bibo-message--pending" : ""}`}>
    <div className="bibo-message__meta">{label}</div>
    <div className="bibo-message__body">
      {role === "assistant"
        ? text
          ? <ReactMarkdown remarkPlugins={markdownPlugins} skipHtml components={markdownComponents}>{text}</ReactMarkdown>
          : pending ? <span className="bibo-message__waiting">正在思考…</span> : null
        : text}
    </div>
    {role === "assistant" && !pending && onCopy && <div className="bibo-message__actions">
      <BiboButton onClick={onCopy}>{copyLabel ?? "复制"}</BiboButton>
    </div>}
  </article>;
}
