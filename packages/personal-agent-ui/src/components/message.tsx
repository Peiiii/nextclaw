import { type ReactNode } from "react";
import { CopyButton } from "./copy-button";
import { Markdown, type MarkdownLabels } from "./markdown/markdown";

type MessageProps = {
  role: "user" | "assistant";
  text: string;
  body?: ReactNode;
  pending?: boolean;
  label: string;
  mark?: ReactNode;
  copyLabel?: string;
  copiedLabel?: string;
  copyFailedLabel?: string;
  waitingLabel?: string;
  markdownLabels?: MarkdownLabels;
  resolveResourceHref?: (uri: string) => string | null;
};

export function Message({ role, text, body, pending = false, label, mark, copyLabel, copiedLabel, copyFailedLabel, waitingLabel, markdownLabels, resolveResourceHref }: MessageProps) {
  return <article className={`ui-message ui-message--${role}${pending ? " ui-message--pending" : ""}`}>
    <div className="ui-message__meta">{role === "assistant" && mark && <span className="ui-message__mark" aria-hidden="true">{mark}</span>}{label}</div>
    <div className="ui-message__body">
      {body !== undefined ? body : text
        ? <Markdown text={text} labels={markdownLabels} role={role} isStreaming={pending && role === "assistant"} resolveResourceHref={resolveResourceHref} />
        : role === "assistant" && pending ? <span className="ui-message__waiting">{waitingLabel}</span> : null}
    </div>
    {role === "assistant" && !pending && text && copyLabel && copiedLabel && copyFailedLabel && <div className="ui-message__actions">
      <CopyButton text={text} label={copyLabel} copiedLabel={copiedLabel} failedLabel={copyFailedLabel} />
    </div>}
  </article>;
}
