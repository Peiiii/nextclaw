import * as React from 'react';
import { X } from 'lucide-react';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
import { cn } from '@/shared/lib/utils';

interface TabsProps {
  defaultValue?: string;
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

const TabsContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
} | null>(null);

export function Tabs({ defaultValue: _defaultValue, value, onValueChange, children }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      {children}
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-xl bg-gray-100/80 p-1 text-gray-500',
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within Tabs');

  const isActive = context.value === value;

  return (
    <button
      type="button"
      onClick={() => context.onValueChange(value)}
      aria-pressed={isActive}
      data-state={isActive ? 'active' : 'inactive'}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-[13px] font-medium ring-offset-white transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        isActive
          ? 'bg-white text-gray-900 shadow-sm'
          : 'hover:bg-white/50 hover:text-gray-800 text-gray-600',
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error('TabsContent must be used within Tabs');

  const isActive = context.value === value;
  if (!isActive) return null;

  return (
    <div className={cn('mt-2 animate-fade-in', className)}>
      {children}
    </div>
  );
}

export type CompactTabStripTab = {
  key: string;
  label: string;
  active: boolean;
  tooltip?: string | null;
  leadingIcon?: React.ReactNode;
  badge?: React.ReactNode;
  unreadIndicator?: React.ReactNode;
  closeLabel?: string;
  closePlacement?: 'leading-hover' | 'trailing';
  onSelect: () => void;
  onClose?: () => void;
};

export type CompactTabStripAction = {
  key: string;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
};

type CompactTabStripProps = {
  tabs: readonly CompactTabStripTab[];
  actions: readonly CompactTabStripAction[];
  className?: string;
  scrollClassName?: string;
  tabsClassName?: string;
  actionsClassName?: string;
  actionButtonClassName?: string;
  tabBaseClassName?: string;
  activeTabClassName?: string;
  inactiveTabClassName?: string;
  labelClassName?: string;
  testId?: string;
  scrollTestId?: string;
  actionsTestId?: string;
  onPointerDown?: (event: React.PointerEvent<HTMLElement>) => void;
  onScrollPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
};

function closeCompactTab(
  event: React.MouseEvent<HTMLButtonElement>,
  onClose: () => void
) {
  event.stopPropagation();
  onClose();
}

function CompactTabItem({
  activeTabClassName,
  inactiveTabClassName,
  labelClassName,
  tab,
  tabBaseClassName,
}: Pick<
  CompactTabStripProps,
  'activeTabClassName' | 'inactiveTabClassName' | 'labelClassName' | 'tabBaseClassName'
> & { tab: CompactTabStripTab }) {
  const leadingClose = tab.onClose && tab.closePlacement === 'leading-hover';
  return (
    <div
      className={cn(
        tabBaseClassName ??
          'group flex max-w-[180px] min-w-0 items-center gap-1.5 border-r border-gray-200/70 border-b-2 px-2.5 py-2 transition-colors',
        tab.active
          ? (activeTabClassName ?? 'border-b-primary bg-white text-gray-900')
          : (inactiveTabClassName ??
            'border-b-transparent bg-gray-50/85 text-gray-500 hover:bg-gray-100'),
      )}
    >
      {leadingClose ? (
        <button
          type="button"
          onClick={(event) => closeCompactTab(event, tab.onClose!)}
          className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
          aria-label={tab.closeLabel}
        >
          <span className="flex items-center justify-center group-hover:hidden">
            {tab.leadingIcon}
          </span>
          <X className="hidden h-3.5 w-3.5 group-hover:block" />
        </button>
      ) : tab.leadingIcon ? (
        <span className="inline-flex shrink-0 items-center justify-center">
          {tab.leadingIcon}
        </span>
      ) : null}
      <button
        type="button"
        onClick={tab.onSelect}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        title={tab.tooltip ?? tab.label}
      >
        <span className={cn('min-w-0 truncate text-[12px] font-medium', labelClassName)}>
          {tab.label}
        </span>
        {tab.badge}
        {tab.unreadIndicator}
      </button>
      {tab.onClose && tab.closePlacement !== 'leading-hover' ? (
        <IconActionButton
          icon={<X className="h-3 w-3" />}
          label={tab.closeLabel ?? ''}
          tooltip={tab.closeLabel ?? null}
          onClick={(event) => closeCompactTab(event, tab.onClose!)}
          className="h-5 w-5 rounded p-0.5 hover:bg-black/10"
        />
      ) : null}
    </div>
  );
}

export function CompactTabStrip({
  actionButtonClassName,
  actions,
  actionsClassName,
  actionsTestId,
  className,
  onPointerDown,
  onScrollPointerDown,
  scrollClassName,
  scrollTestId,
  tabs,
  tabsClassName,
  testId,
  ...tabProps
}: CompactTabStripProps) {
  return (
    <div
      data-testid={testId}
      className={cn('flex min-w-0 items-stretch border-b border-gray-200/70 bg-gray-50/85', className)}
      onPointerDown={onPointerDown}
    >
      <div
        className={cn('min-w-0 flex-1 overflow-x-auto overflow-y-hidden', scrollClassName)}
        onPointerDown={onScrollPointerDown}
      >
        <div data-testid={scrollTestId} className={cn('flex min-w-max items-stretch', tabsClassName)}>
          {tabs.map((tab) => (
            <CompactTabItem key={tab.key} tab={tab} {...tabProps} />
          ))}
        </div>
      </div>
      <div
        className={cn('flex shrink-0 items-center gap-1', actionsClassName)}
        data-testid={actionsTestId}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {actions.map((action) => (
          <IconActionButton
            key={action.key}
              icon={action.icon}
              label={action.label}
              disabled={action.disabled}
            onClick={action.onClick}
            className={actionButtonClassName}
          />
        ))}
      </div>
    </div>
  );
}
