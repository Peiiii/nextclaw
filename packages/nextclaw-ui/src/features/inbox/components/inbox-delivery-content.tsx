import { ChatMessageMarkdown } from "@nextclaw/agent-chat-ui";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

export function InboxDeliveryContent({
  className,
  content,
}: {
  className?: string;
  content: string;
}) {
  return (
    <div className={cn("inbox-delivery-content", className)}>
      <ChatMessageMarkdown
        text={content}
        role="assistant"
        texts={{
          copyCodeLabel: t("chatCodeCopy"),
          copiedCodeLabel: t("chatCodeCopied"),
        }}
      />
    </div>
  );
}
