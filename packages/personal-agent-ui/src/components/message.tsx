import { type ReactNode } from "react";
import { Button } from "./button";
import { Markdown, type MarkdownLabels } from "./markdown/markdown";

type MessageProps = {
  role: "user" | "assistant";
  text: string;
  pending?: boolean;
  label: string;
  mark?: ReactNode;
  copyLabel?: string;
  waitingLabel?: string;
  markdownLabels?: MarkdownLabels;
  onCopy?: () => void;
};

export function Message({ role, text, pending = false, label, mark, copyLabel, waitingLabel, markdownLabels, onCopy }: MessageProps) {
  return <article className={`ui-message ui-message--${role}${pending ? " ui-message--pending" : ""}`}>
    <div className="ui-message__meta">{role === "assistant" && mark && <span className="ui-message__mark" aria-hidden="true">{mark}</span>}{label}</div>
    <div className="ui-message__body">
      {role === "assistant"
        ? text
          ? <Markdown text={text} labels={markdownLabels} />
          : pending ? <span className="ui-message__waiting">{waitingLabel}</span> : null
        : text}
    </div>
    {role === "assistant" && !pending && onCopy && copyLabel && <div className="ui-message__actions">
      <Button onClick={onCopy}>{copyLabel}</Button>
    </div>}
  </article>;
}
