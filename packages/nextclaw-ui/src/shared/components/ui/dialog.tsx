import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/shared/lib/utils"
import { deferEscapeToNestedMenu } from './context-menu/context-menu';
import { IconActionButton } from './actions/icon-action-button';
import { t } from '@/shared/lib/i18n';

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-theme-overlay="modal-backdrop"
    className={cn(
      "fixed inset-0 z-[var(--z-modal-backdrop,10000)] bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      data-theme-overlay="dialog"
      className={cn(
        "fixed left-[50%] top-[50%] z-[var(--z-modal,10050)] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rounded-2xl border border-border bg-popover p-6 text-popover-foreground shadow-xl duration-base data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
        "max-md:max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-1.5rem)] max-md:max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem)] overflow-y-auto overscroll-contain",
        className
      )}
      {...props}
      onEscapeKeyDown={(event) => {
        if (!deferEscapeToNestedMenu(event)) props.onEscapeKeyDown?.(event);
      }}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  children,
  actions,
  showClose = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  actions?: React.ReactNode;
  showClose?: boolean;
}) => (
  <div
    data-slot="dialog-header"
    className={cn(
      "grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-left",
      className
    )}
    {...props}
  >
    <div className="min-w-0 space-y-2 break-words">{children}</div>
    <div className="flex shrink-0 items-center gap-2" data-slot="dialog-header-controls">
      {actions ? <div className="flex items-center gap-1" data-slot="dialog-header-actions">{actions}</div> : null}
      {showClose ? (
        <div className={cn("flex shrink-0", actions && "pl-2")}>
          <DialogPrimitive.Close asChild>
            <IconActionButton
              size="sm"
              label={t('close')}
              icon={<X className="h-4 w-4" />}
              className="max-md:h-11 max-md:w-11"
            />
          </DialogPrimitive.Close>
        </div>
      ) : null}
    </div>
  </div>
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-tight tracking-tight text-foreground",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground leading-relaxed", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
