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
  copyText?: string;
  copiedLabel?: string;
  copyFailedLabel?: string;
  waitingLabel?: string;
  markdownLabels?: MarkdownLabels;
  resolveResourceHref?: (uri: string) => string | null;
};

export function Message({ role, text, body, pending = false, label, mark, copyLabel, copyText, copiedLabel, copyFailedLabel, waitingLabel, markdownLabels, resolveResourceHref }: MessageProps) {
  const waiting = role === "assistant" && pending && !text && body === undefined;
  return <article className={`ui-message ui-message--${role}${pending ? " ui-message--pending" : ""}${waiting ? " ui-message--waiting" : ""}`}>
    <div className="ui-message__meta">{role === "assistant" && mark && <span className="ui-message__mark" aria-hidden="true">{mark}</span>}{label}</div>
    <div className="ui-message__body">
      {body !== undefined ? body : text
        ? <Markdown text={text} labels={markdownLabels} role={role} isStreaming={pending && role === "assistant"} resolveResourceHref={resolveResourceHref} />
        : waiting ? <span className="ui-message__waiting" role="status"><span className="ui-message__waiting-label">{waitingLabel}</span><span aria-hidden="true" className="ui-message__typing"><i /><i /><i /></span></span> : null}
    </div>
    {role === "assistant" && !pending && text && copyLabel && copiedLabel && copyFailedLabel && <div className="ui-message__actions">
      <CopyButton text={copyText ?? text} label={copyLabel} copiedLabel={copiedLabel} failedLabel={copyFailedLabel} />
    </div>}
  </article>;
}
