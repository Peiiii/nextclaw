import { useEffect } from "react";
import { useAppPresenter } from "@/app/components/app-presenter-provider";

export function AppNotificationRuntime() {
  const presenter = useAppPresenter();

  useEffect(() => {
    presenter.chatCompletionNotificationManager.start();
    return () => {
      presenter.chatCompletionNotificationManager.stop();
    };
  }, [presenter.chatCompletionNotificationManager]);

  return null;
}
