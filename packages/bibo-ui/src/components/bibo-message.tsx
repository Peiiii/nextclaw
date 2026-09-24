import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BiboButton } from "./bibo-button";

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
      {role === "assistant" && !pending
        ? <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
          a: ({ href, children }) => href && /^https?:\/\//i.test(href)
            ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
            : <span>{children}</span>,
          img: ({ alt }) => <span>{alt ?? "图片"}</span>,
        }}>{text}</ReactMarkdown>
        : text || (pending && role === "assistant" ? "正在思考…" : "")}
    </div>
    {role === "assistant" && !pending && onCopy && <div className="bibo-message__actions">
      <BiboButton onClick={onCopy}>{copyLabel ?? "复制"}</BiboButton>
    </div>}
  </article>;
}
