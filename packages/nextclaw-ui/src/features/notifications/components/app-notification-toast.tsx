import { X } from "lucide-react";
import { Link } from "react-router-dom";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";

export type AppNotificationToastProps = {
  title: string;
  description?: string;
  href?: string;
  iconSrc?: string;
  ariaLabel?: string;
  dismissLabel: string;
  onDismiss: () => void;
};

const NOTIFICATION_CARD_CLASS =
  "relative ml-auto flex min-h-[74px] w-[320px] max-w-[calc(100vw-2rem)] rounded-[20px] border border-border/80 bg-background text-left text-foreground shadow-[0_8px_18px_rgba(0,0,0,0.12),0_2px_5px_rgba(0,0,0,0.06)]";

const NOTIFICATION_CONTENT_CLASS =
  "flex min-h-[72px] min-w-0 flex-1 items-center gap-3 rounded-[inherit] py-3 pl-[18px] pr-[52px]";

function AppNotificationContent({
  title,
  description,
  iconSrc,
}: Pick<AppNotificationToastProps, "title" | "description" | "iconSrc">) {
  return (
    <>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background p-[3px]">
        <img
          aria-hidden="true"
          alt=""
          src={iconSrc ?? "/logo.svg"}
          className="h-full w-full object-contain"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold leading-5 tracking-[-0.01em]">
          {title}
        </span>
        {description ? (
          <span className="mt-0.5 block truncate text-[14px] leading-5 text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </>
  );
}

function AppNotificationDismissButton({
  dismissLabel,
  onDismiss,
}: Pick<AppNotificationToastProps, "dismissLabel" | "onDismiss">) {
  return (
    <IconActionButton
      className="absolute right-2.5 top-2.5 z-10"
      icon={<X className="h-4 w-4" aria-hidden="true" />}
      label={dismissLabel}
      onClick={onDismiss}
      size="lg"
      tooltipSide="left"
    />
  );
}

export function AppNotificationToast({
  title,
  description,
  href,
  iconSrc,
  ariaLabel,
  dismissLabel,
  onDismiss,
}: AppNotificationToastProps) {
  const accessibleLabel = ariaLabel ?? [title, description].filter(Boolean).join(": ");

  if (href) {
    return (
      <div className={NOTIFICATION_CARD_CLASS}>
        <Link
          to={href}
          aria-label={accessibleLabel}
          className={`${NOTIFICATION_CONTENT_CLASS} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50`}
          onClick={onDismiss}
        >
          <AppNotificationContent
            title={title}
            description={description}
            iconSrc={iconSrc}
          />
        </Link>
        <AppNotificationDismissButton
          dismissLabel={dismissLabel}
          onDismiss={onDismiss}
        />
      </div>
    );
  }

  return (
    <div className={NOTIFICATION_CARD_CLASS}>
      <div
        role="status"
        aria-label={accessibleLabel}
        className={NOTIFICATION_CONTENT_CLASS}
      >
        <AppNotificationContent
          title={title}
          description={description}
          iconSrc={iconSrc}
        />
      </div>
      <AppNotificationDismissButton
        dismissLabel={dismissLabel}
        onDismiss={onDismiss}
      />
    </div>
  );
}
