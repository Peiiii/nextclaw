import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

const CHAT_CONVERSATION_SKELETON_BUBBLES = [
  {
    key: "hero",
    alignmentClassName: "justify-start",
    bubbleClassName: "max-w-[78%] h-32 rounded-[30px]",
  },
  {
    key: "follow-up",
    alignmentClassName: "justify-start",
    bubbleClassName: "max-w-[62%] h-24 rounded-[28px]",
  },
  {
    key: "reply",
    alignmentClassName: "justify-end",
    bubbleClassName: "max-w-[70%] h-24 rounded-[28px]",
  },
  {
    key: "detail",
    alignmentClassName: "justify-start",
    bubbleClassName: "max-w-[88%] h-36 rounded-[30px]",
  },
] as const;

export function ChatConversationSkeleton() {
  return (
    <section
      data-testid="chat-conversation-skeleton"
      className="flex-1 min-h-0 flex flex-col overflow-hidden bg-gradient-to-b from-gray-50/60 to-white"
    >
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="mx-auto flex min-h-full w-full max-w-[min(1120px,100%)] flex-col px-6 py-5">
          <div className="flex flex-1 flex-col gap-8">
            <div className="space-y-6">
              <Skeleton className="h-6 w-52 rounded-lg bg-gray-200/90" />
              <div className="space-y-5">
                {CHAT_CONVERSATION_SKELETON_BUBBLES.map((bubble) => (
                  <div
                    key={bubble.key}
                    className={cn("flex w-full", bubble.alignmentClassName)}
                  >
                    <Skeleton
                      data-testid="chat-conversation-skeleton-bubble"
                      className={cn(
                        "w-full bg-gray-200/80",
                        bubble.bubbleClassName,
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-auto grid gap-4 pb-2 sm:grid-cols-[minmax(0,1fr)_minmax(180px,240px)] sm:items-end">
              <div className="space-y-3">
                <Skeleton className="h-4 w-40 rounded-full bg-gray-200/70" />
                <Skeleton className="h-[112px] w-full rounded-[30px] bg-gray-200/70" />
              </div>
              <div className="hidden justify-end sm:flex">
                <Skeleton className="h-10 w-36 rounded-full bg-gray-200/75" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-gray-200/80 bg-white p-4">
        <div className="mx-auto w-full max-w-[min(1120px,100%)]">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-card">
            <div className="px-4 py-2.5">
              <Skeleton className="h-[84px] w-full rounded-[28px] bg-gray-200/80" />
            </div>
            <div className="flex items-center justify-between gap-3 px-3 pb-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-20 rounded-full bg-gray-200/75" />
                <Skeleton className="h-8 w-28 rounded-full bg-gray-200/75" />
                <Skeleton className="hidden h-8 w-24 rounded-full bg-gray-200/70 sm:block" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full bg-gray-200/85" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
