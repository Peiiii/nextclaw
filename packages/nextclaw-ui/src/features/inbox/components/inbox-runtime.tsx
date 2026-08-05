import { useEffect } from "react";
import { useAppPresenter } from "@/app/components/app-presenter-provider";
import { InboxReaderDialog } from "@/features/inbox/components/inbox-reader-dialog";

export function InboxRuntime() {
  const { inboxManager } = useAppPresenter();

  useEffect(() => {
    inboxManager.start();
    return () => inboxManager.stop();
  }, [inboxManager]);

  return <InboxReaderDialog />;
}
