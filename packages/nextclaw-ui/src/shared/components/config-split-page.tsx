import { Children, type ButtonHTMLAttributes, type HTMLAttributes, useEffect, useRef, useState } from 'react';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

const PANE_CLASS = 'min-w-0 overflow-hidden bg-card/70 text-card-foreground md:h-[calc(100vh-180px)] md:max-h-[860px]';
const SHELL_CLASS = 'min-h-0 overflow-hidden rounded-2xl bg-muted/30 ring-1 ring-border/45';
const COMPACT_WIDTH = 640;
type DivProps = HTMLAttributes<HTMLDivElement>;
type SectionProps = HTMLAttributes<HTMLElement>;

export function ConfigSplitPage({
  className,
  children,
  compactView,
  onMobileBack,
  mobileListLabel,
  ...props
}: DivProps & {
  compactView?: 'list' | 'detail';
  onMobileBack?: () => void;
  mobileListLabel?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);
  const childArray = Children.toArray(children);
  const [sidebarChild, detailChild, ...remainingChildren] = childArray;

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !compactView || typeof ResizeObserver === 'undefined') return;
    const update = () => setIsCompact(root.clientWidth > 0 && root.clientWidth < COMPACT_WIDTH);
    const observer = new ResizeObserver(update);
    observer.observe(root);
    update();
    return () => observer.disconnect();
  }, [compactView]);

  const shouldUseCompactView = Boolean(isCompact && compactView && sidebarChild && detailChild);

  return (
    <div ref={rootRef} className={cn('min-h-0 md:flex-1', className)} {...props}>
      {shouldUseCompactView ? (
        <div className='space-y-3'>
          {compactView === 'detail' ? (
            <>
              <button
                type='button'
                onClick={onMobileBack}
                className='inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'
              >
                <ArrowLeft className='h-4 w-4' />
                <span>{mobileListLabel ?? t('backToMain')}</span>
              </button>
              <div className={SHELL_CLASS}>{detailChild}</div>
            </>
          ) : (
            <div className={SHELL_CLASS}>{sidebarChild}</div>
          )}
          {remainingChildren}
        </div>
      ) : (
        <div className={cn(SHELL_CLASS, 'grid grid-cols-1 md:grid-cols-[minmax(240px,30%)_minmax(0,1fr)]')}>
          {children}
        </div>
      )}
    </div>
  );
}

export function ConfigSplitSidebar({ className, ...props }: SectionProps) {
  return <section className={cn(PANE_CLASS, 'flex flex-col md:border-r md:border-border/55', className)} {...props} />;
}

export function ConfigSplitDetailPane({ className, ...props }: SectionProps) {
  return <section className={cn(PANE_CLASS, 'flex flex-col', className)} {...props} />;
}

export function ConfigSplitEmptyPane({ className, ...props }: SectionProps) {
  return (
    <section
      className={cn(PANE_CLASS, 'flex items-center justify-center px-6 py-12 text-center', className)}
      {...props}
    />
  );
}

export function ConfigSplitPaneHeader({ className, ...props }: DivProps) {
  return <div className={cn('shrink-0 border-b border-border/70', className)} {...props} />;
}

export function ConfigSplitPaneBody({
  className,
  scrollOnDesktop = true,
  ...props
}: DivProps & { scrollOnDesktop?: boolean }) {
  return (
    <div
      className={cn(
        'min-h-0 flex-1',
        scrollOnDesktop && 'overflow-visible md:overflow-y-auto md:overscroll-contain',
        className
      )}
      {...props}
    />
  );
}

export function ConfigSplitPaneFooter({ className, ...props }: DivProps) {
  return <div className={cn('shrink-0 border-t border-border/70 px-4 py-2.5', className)} {...props} />;
}

export function ConfigSelectionCard({
  active = false,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type={type}
      className={cn(
        'w-full rounded-xl p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        active
          ? 'bg-background/95 text-foreground shadow-sm'
          : 'bg-transparent text-muted-foreground hover:bg-background/65 hover:text-foreground',
        className
      )}
      {...props}
    />
  );
}

export function ConfigSplitEmptyState({
  icon: Icon,
  title,
  description,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-[220px] flex-col items-center justify-center rounded-xl bg-background/55 px-4 py-10 text-center',
        className
      )}
      {...props}
    >
      <div className='mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-card'>
        <Icon className='h-5 w-5 text-muted-foreground/45' />
      </div>
      <p className='text-sm font-medium text-foreground'>{title}</p>
      {description ? <p className='mt-2 text-xs text-muted-foreground'>{description}</p> : null}
    </div>
  );
}
