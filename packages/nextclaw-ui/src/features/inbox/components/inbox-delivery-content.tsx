import { useMemo } from "react";
import type { InboxDeliveryContentType } from "@nextclaw/shared";
import { ChatMessageMarkdown } from "@nextclaw/agent-chat-ui";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

const HTML_PREVIEW_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "base-uri 'none'",
  "connect-src 'none'",
  "font-src data:",
  "form-action 'none'",
  "frame-src 'none'",
  "img-src data: blob:",
  "media-src data: blob:",
  "object-src 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline'",
].join("; ");

function createIsolatedHtmlDocument(content: string): string {
  const document = new DOMParser().parseFromString(content, "text/html");
  document.querySelectorAll("base, script").forEach((element) => element.remove());
  document.querySelectorAll("meta[http-equiv]").forEach((element) => {
    const directive = element.getAttribute("http-equiv")?.toLowerCase();
    if (directive === "content-security-policy" || directive === "refresh") {
      element.remove();
    }
  });
  document.querySelectorAll("*").forEach((element) => {
    element.getAttributeNames()
      .filter((attribute) => attribute.toLowerCase().startsWith("on"))
      .forEach((attribute) => element.removeAttribute(attribute));
  });
  document.querySelectorAll("a[href]").forEach((element) => {
    const href = element.getAttribute("href")?.trim() ?? "";
    if (href.toLowerCase().startsWith("javascript:")) {
      element.removeAttribute("href");
      return;
    }
    element.setAttribute("target", href.startsWith("#") ? "_self" : "_blank");
    element.setAttribute("rel", "noopener noreferrer");
  });

  const policy = document.createElement("meta");
  policy.setAttribute("http-equiv", "Content-Security-Policy");
  policy.setAttribute("content", HTML_PREVIEW_CONTENT_SECURITY_POLICY);
  document.head.prepend(policy);

  const defaults = document.createElement("style");
  defaults.dataset.nextclawInboxDefaults = "";
  defaults.textContent = [
    ":root { color-scheme: light dark; }",
    "*, *::before, *::after { box-sizing: border-box; }",
    "body { margin: 0; padding: 24px; color: CanvasText; background: Canvas; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; overflow-wrap: anywhere; }",
    "img, svg, video { max-width: 100%; height: auto; }",
    "pre { max-width: 100%; overflow: auto; }",
  ].join("\n");
  policy.after(defaults);

  return `<!doctype html>${document.documentElement.outerHTML}`;
}

function InboxHtmlContent({
  content,
  fillHeight,
  title,
}: {
  content: string;
  fillHeight: boolean;
  title: string;
}) {
  const document = useMemo(() => createIsolatedHtmlDocument(content), [content]);
  return (
    <iframe
      className={cn(
        "w-full rounded-xl bg-background",
        fillHeight
          ? "h-full min-h-0 border-0"
          : "h-[min(60vh,680px)] min-h-[360px] border border-border/70",
      )}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      srcDoc={document}
      title={title}
    />
  );
}

export function InboxDeliveryContent({
  className,
  content,
  contentType,
  fillHeight = false,
  title,
}: {
  className?: string;
  content: string;
  contentType: InboxDeliveryContentType;
  fillHeight?: boolean;
  title: string;
}) {
  return (
    <div className={cn("inbox-delivery-content", className)}>
      {contentType === "html" ? (
        <InboxHtmlContent content={content} fillHeight={fillHeight} title={title} />
      ) : (
        <ChatMessageMarkdown
          text={content}
          role="assistant"
          texts={{
            copyCodeLabel: t("chatCodeCopy"),
            copiedCodeLabel: t("chatCodeCopied"),
          }}
        />
      )}
    </div>
  );
}
