import { type ReactNode } from "react";
import { CopyButton } from "./copy-button";
import { Markdown, type MarkdownLabels } from "./markdown/markdown";

type MessageProps = {
  role: "user" | "assistant";
  text: string;
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

export function Message({ role, text, pending = false, label, mark, copyLabel, copiedLabel, copyFailedLabel, waitingLabel, markdownLabels, resolveResourceHref }: MessageProps) {
  return <article className={`ui-message ui-message--${role}${pending ? " ui-message--pending" : ""}`}>
    <div className="ui-message__meta">{role === "assistant" && mark && <span className="ui-message__mark" aria-hidden="true">{mark}</span>}{label}</div>
    <div className="ui-message__body">
      {role === "assistant"
        ? text
          ? <Markdown text={text} labels={markdownLabels} isStreaming={pending} resolveResourceHref={resolveResourceHref} />
          : pending ? <span className="ui-message__waiting">{waitingLabel}</span> : null
        : text}
    </div>
    {role === "assistant" && !pending && text && copyLabel && copiedLabel && copyFailedLabel && <div className="ui-message__actions">
      <CopyButton text={text} label={copyLabel} copiedLabel={copiedLabel} failedLabel={copyFailedLabel} />
    </div>}
  </article>;
}
