import { Maximize2, X } from "lucide-react";
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
  action?: { label: string; onClick: () => void };
};

const NOTIFICATION_CARD_CLASS =
  "relative ml-auto flex min-h-[68px] w-[360px] max-w-[calc(100vw-2rem)] items-center rounded-2xl border border-border/80 bg-background text-left text-foreground shadow-[0_8px_18px_rgba(0,0,0,0.12),0_2px_5px_rgba(0,0,0,0.06)]";

const NOTIFICATION_CONTENT_CLASS =
  "flex min-h-[66px] min-w-0 flex-1 items-center gap-2.5 rounded-[inherit] py-3 pl-3.5 pr-1";

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

function AppNotificationActions({
  dismissLabel,
  onDismiss,
  action,
}: Pick<AppNotificationToastProps, "dismissLabel" | "onDismiss" | "action">) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 pr-2">
      {action ? (
        <IconActionButton
          icon={<Maximize2 className="h-4 w-4" aria-hidden="true" />}
          label={action.label}
          className="h-9 w-9"
          size="lg"
          onClick={() => {
            action.onClick();
            onDismiss();
          }}
        />
      ) : null}
      <IconActionButton
        icon={<X className="h-4 w-4" aria-hidden="true" />}
        label={dismissLabel}
        onClick={onDismiss}
        className="h-9 w-9"
        size="lg"
      />
    </div>
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
  action,
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
        <AppNotificationActions
          action={action}
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
      <AppNotificationActions
        action={action}
        dismissLabel={dismissLabel}
        onDismiss={onDismiss}
      />
    </div>
  );
}
