import { createElement } from "react";
import { toast } from "sonner";
import { AppNotificationToast } from "@/features/notifications/components/app-notification-toast";

export type AppNotification = {
  id?: string | number;
  title: string;
  description?: string;
  href?: string;
  iconSrc?: string;
  ariaLabel?: string;
  durationMs?: number;
};

const DEFAULT_NOTIFICATION_DURATION_MS = 8_000;

export class AppNotificationManager {
  show = (notification: AppNotification): string | number =>
    toast.custom(
      (toastId) =>
        createElement(AppNotificationToast, {
          title: notification.title,
          description: notification.description,
          href: notification.href,
          iconSrc: notification.iconSrc,
          ariaLabel: notification.ariaLabel,
          onDismiss: () => {
            toast.dismiss(toastId);
          },
        }),
      {
        id: notification.id,
        duration: notification.durationMs ?? DEFAULT_NOTIFICATION_DURATION_MS,
        unstyled: true,
      },
    );

  dismiss = (id: string | number): void => {
    toast.dismiss(id);
  };
}
