import { cn } from "../../../internal/cn";
import {
  buildChatMessageFileMeta,
  FILE_CATEGORY_LABELS,
  FILE_CATEGORY_TILE_CLASSES,
  type ChatMessageFileView,
} from "./meta";

type ChatMessageFileProps = {
  file: ChatMessageFileView;
  isUser?: boolean;
};

function renderMetaBadge(label: string, isUser: boolean) {
  return (
    <span
      key={label}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
        isUser
          ? "border-white/12 bg-white/10 text-white/82"
          : "border-slate-200/80 bg-slate-950/[0.04] text-slate-600",
      )}
    >
      {label}
    </span>
  );
}

function renderMimeType(mimeType: string, isUser: boolean) {
  return (
    <div
      className={cn(
        "truncate text-[11px]",
        isUser ? "text-white/58" : "text-slate-500",
      )}
    >
      {mimeType}
    </div>
  );
}

function renderActionPill(
  label: string,
  isUser: boolean,
  isInteractive: boolean,
) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
        isInteractive
          ? isUser
            ? "border-white/14 bg-white/12 text-white"
            : "border-slate-200/80 bg-white text-slate-700"
          : isUser
            ? "border-white/10 bg-white/6 text-white/62"
            : "border-slate-200/70 bg-slate-100/80 text-slate-500",
      )}
    >
      {label}
    </span>
  );
}

export function ChatMessageFile({
  file,
  isUser = false,
}: ChatMessageFileProps) {
  const { category, extension, metaBadges, sizeLabel } =
    buildChatMessageFileMeta(file);
  const isInteractive = Boolean(file.dataUrl);
  const actionLabel = isInteractive
    ? file.isImage
      ? "Open preview"
      : "Open file"
    : "Attached";
  const tileLabel = extension.slice(0, 4);
  const shellClasses = cn(
    "block overflow-hidden rounded-[1.25rem] border transition duration-200",
    isUser
      ? "border-white/12 bg-white/10 text-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.85)]"
      : "border-slate-200/80 bg-white/95 text-slate-900 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.28)]",
    isInteractive &&
      (isUser
        ? "hover:border-white/18 hover:bg-white/13"
        : "hover:border-slate-300 hover:bg-white hover:shadow-[0_24px_50px_-30px_rgba(15,23,42,0.3)]"),
  );

  if (file.isImage && file.dataUrl) {
    return (
      <a
        href={file.dataUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open preview: ${file.label}`}
        className={cn(shellClasses, "group")}
      >
        <figure>
          <div
            className={cn(
              "relative overflow-hidden p-2",
              isUser
                ? "bg-white/[0.04]"
                : "bg-gradient-to-br from-slate-100 via-white to-slate-100",
            )}
          >
            <img
              src={file.dataUrl}
              alt={file.label}
              className="block max-h-[22rem] w-full rounded-[1rem] object-cover shadow-[0_18px_40px_-26px_rgba(15,23,42,0.55)] transition duration-300 group-hover:scale-[1.01]"
            />
            <div className="pointer-events-none absolute inset-x-4 top-4 flex items-center justify-between">
              {sizeLabel ? renderMetaBadge(sizeLabel, isUser) : <span />}
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.22em]",
                  isUser
                    ? "border-white/12 bg-slate-950/20 text-white"
                    : FILE_CATEGORY_TILE_CLASSES[category],
                )}
              >
                {tileLabel}
              </span>
            </div>
          </div>
          <figcaption className="flex items-start gap-3 p-4">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border text-[11px] font-semibold tracking-[0.22em]",
                isUser
                  ? "border-white/12 bg-white/10 text-white"
                  : FILE_CATEGORY_TILE_CLASSES[category],
              )}
            >
              {tileLabel}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold leading-5">
                {file.label}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {metaBadges.map((label) => renderMetaBadge(label, isUser))}
              </div>
              <div className="mt-2">
                {renderMimeType(file.mimeType, isUser)}
              </div>
            </div>
            {renderActionPill(actionLabel, isUser, true)}
          </figcaption>
        </figure>
      </a>
    );
  }

  const content = (
    <div className="flex items-start gap-3 p-3.5">
      <div
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-[1rem] border text-xs font-semibold tracking-[0.22em]",
          isUser
            ? "border-white/12 bg-white/10 text-white"
            : FILE_CATEGORY_TILE_CLASSES[category],
        )}
      >
        {tileLabel}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold leading-5">
              {file.label}
            </div>
            <div
              className={cn(
                "mt-1 text-xs",
                isUser ? "text-white/68" : "text-slate-500",
              )}
            >
              {FILE_CATEGORY_LABELS[category]} attachment
            </div>
          </div>
          {renderActionPill(actionLabel, isUser, isInteractive)}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {metaBadges.map((label) => renderMetaBadge(label, isUser))}
        </div>
        <div className="mt-2">{renderMimeType(file.mimeType, isUser)}</div>
      </div>
    </div>
  );

  if (!isInteractive) {
    return <div className={shellClasses}>{content}</div>;
  }

  return (
    <a
      href={file.dataUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open file: ${file.label}`}
      className={cn(shellClasses, "group")}
    >
      {content}
    </a>
  );
}
