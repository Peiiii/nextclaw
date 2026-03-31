import type {
  ChatInlineContentSegmentViewModel,
  ChatMessageRole,
  ChatMessageTexts,
} from "../../view-models/chat-ui.types";
import { cn } from "../../internal/cn";
import { ChatMessageMarkdown } from "./chat-message-markdown";

type ChatMessageInlineContentProps = {
  segments: ChatInlineContentSegmentViewModel[];
  role: ChatMessageRole;
  texts: Pick<ChatMessageTexts, "copyCodeLabel" | "copiedCodeLabel">;
};

function hasVisibleInlineText(value: string): boolean {
  return value
    .split("\u200B")
    .join("")
    .split("\u200C")
    .join("")
    .split("\u200D")
    .join("")
    .split("\u2060")
    .join("")
    .split("\uFEFF")
    .join("").length > 0;
}

function ChatInlineSkillIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-3 w-3"
    >
      <path d="M8.5 2.75 2.75 6l5.75 3.25L14.25 6 8.5 2.75Z" />
      <path d="M2.75 10 8.5 13.25 14.25 10" />
      <path d="M2.75 6v4l5.75 3.25V9.25L2.75 6Z" />
      <path d="M14.25 6v4L8.5 13.25V9.25L14.25 6Z" />
    </svg>
  );
}

function ChatInlineTokenBadge({
  kind,
  label,
  isUser,
}: {
  kind: string;
  label: string;
  isUser: boolean;
}) {
  const isSkill = kind === "skill";
  return (
    <span
      className={cn(
        "mx-[2px] inline-flex h-7 max-w-full items-center gap-1.5 rounded-lg border px-2 align-baseline text-[11px] font-medium",
        isSkill
          ? isUser
            ? "border-white/25 bg-white/16 text-white"
            : "border-primary/12 bg-primary/8 text-primary"
          : isUser
            ? "border-white/20 bg-white/12 text-white"
            : "border-slate-200/80 bg-slate-50 text-slate-700",
      )}
      title={label}
    >
      <span
        className={cn(
          "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center",
          isSkill
            ? isUser
              ? "text-white/75"
              : "text-primary/70"
            : isUser
              ? "text-white/70"
              : "text-slate-500",
        )}
      >
        <ChatInlineSkillIcon />
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}

export function ChatMessageInlineContent({
  segments,
  role,
  texts,
}: ChatMessageInlineContentProps) {
  const isUser = role === "user";

  return (
    <div className="whitespace-pre-wrap break-words leading-6">
      {segments.map((segment, index) => {
        if (segment.type === "token") {
          return (
            <ChatInlineTokenBadge
              key={`token-${index}-${segment.token.kind}-${segment.token.key}`}
              kind={segment.token.kind}
              label={segment.token.label}
              isUser={isUser}
            />
          );
        }
        if (!hasVisibleInlineText(segment.text)) {
          return (
            <span key={`space-${index}`} className="whitespace-pre-wrap">
              {segment.text}
            </span>
          );
        }
        return (
          <ChatMessageMarkdown
            key={`markdown-${index}`}
            text={segment.text}
            role={role}
            texts={texts}
            inline
          />
        );
      })}
    </div>
  );
}
