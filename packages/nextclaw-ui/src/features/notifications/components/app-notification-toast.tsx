import { Link } from "react-router-dom";

export type AppNotificationToastProps = {
  title: string;
  description?: string;
  href?: string;
  iconSrc?: string;
  ariaLabel?: string;
  onDismiss: () => void;
};

const NOTIFICATION_CARD_CLASS =
  "group ml-auto flex min-h-[74px] w-[320px] max-w-[calc(100vw-2rem)] items-center gap-3 rounded-[20px] border border-border/80 bg-background px-[18px] py-3 text-left text-foreground shadow-[0_8px_18px_rgba(0,0,0,0.12),0_2px_5px_rgba(0,0,0,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

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

export function AppNotificationToast({
  title,
  description,
  href,
  iconSrc,
  ariaLabel,
  onDismiss,
}: AppNotificationToastProps) {
  const accessibleLabel = ariaLabel ?? [title, description].filter(Boolean).join(": ");

  if (href) {
    return (
      <Link
        to={href}
        aria-label={accessibleLabel}
        className={NOTIFICATION_CARD_CLASS}
        onClick={onDismiss}
      >
        <AppNotificationContent
          title={title}
          description={description}
          iconSrc={iconSrc}
        />
      </Link>
    );
  }

  return (
    <div role="status" aria-label={accessibleLabel} className={NOTIFICATION_CARD_CLASS}>
      <AppNotificationContent
        title={title}
        description={description}
        iconSrc={iconSrc}
      />
    </div>
  );
}
