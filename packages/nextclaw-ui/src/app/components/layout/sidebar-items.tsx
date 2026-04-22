import type { ComponentType, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Select, SelectContent, SelectTrigger } from '@/shared/components/ui/select';
import { cn } from '@/shared/lib/utils';

type SidebarIcon = ComponentType<{ className?: string }>;
type SidebarItemDensity = 'default' | 'compact';

type SidebarItemTone = {
  row: string;
  icon: string;
  value: string;
  gap: string;
};

const SIDEBAR_ITEM_TONES: Record<SidebarItemDensity, SidebarItemTone> = {
  default: {
    row: 'gap-3 px-3 py-2.5 text-[14px]',
    icon: 'h-[17px] w-[17px]',
    value: 'text-xs',
    gap: 'gap-3'
  },
  compact: {
    row: 'gap-2.5 px-3 py-2 text-[13px]',
    icon: 'h-4 w-4',
    value: 'text-[11px]',
    gap: 'gap-2.5'
  }
};

function getSidebarItemTone(density: SidebarItemDensity): SidebarItemTone {
  return SIDEBAR_ITEM_TONES[density];
}

type SidebarNavLinkItemProps = {
  to: string;
  label: ReactNode;
  icon: SidebarIcon;
  density?: SidebarItemDensity;
  className?: string;
};

export function SidebarNavLinkItem({
  to,
  label,
  icon: Icon,
  density = 'default',
  className
}: SidebarNavLinkItemProps) {
  const tone = getSidebarItemTone(density);

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'group flex w-full items-center rounded-xl font-medium transition-colors duration-base',
          tone.row,
          isActive
            ? 'bg-gray-200 text-gray-900 shadow-sm'
            : 'text-gray-600 hover:bg-gray-200/60 hover:text-gray-900',
          className
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              tone.icon,
              'transition-colors',
              isActive ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-800'
            )}
          />
          <span className="min-w-0 flex-1 text-left">{label}</span>
        </>
      )}
    </NavLink>
  );
}

type SidebarActionItemProps = {
  label: ReactNode;
  icon: SidebarIcon;
  onClick: () => void;
  density?: SidebarItemDensity;
  className?: string;
  labelClassName?: string;
  trailing?: ReactNode;
  trailingClassName?: string;
  testId?: string;
  trailingTestId?: string;
};

export function SidebarActionItem({
  label,
  icon: Icon,
  onClick,
  density = 'default',
  className,
  labelClassName,
  trailing,
  trailingClassName,
  testId,
  trailingTestId
}: SidebarActionItemProps) {
  const tone = getSidebarItemTone(density);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center rounded-xl font-medium text-gray-600 transition-all duration-base hover:bg-gray-200/60 hover:text-gray-800',
        tone.row,
        className
      )}
      data-testid={testId}
    >
      <Icon className={cn(tone.icon, 'shrink-0 text-gray-400')} />
      <span className={cn('min-w-0 flex-1 text-left', labelClassName)}>{label}</span>
      {trailing ? (
        <span
          className={cn('shrink-0 text-gray-500', tone.value, trailingClassName)}
          data-testid={trailingTestId}
        >
          {trailing}
        </span>
      ) : null}
    </button>
  );
}

type SidebarSelectItemProps = {
  label: ReactNode;
  icon: SidebarIcon;
  value: string;
  valueLabel: ReactNode;
  onValueChange: (value: string) => void;
  density?: SidebarItemDensity;
  children: ReactNode;
};

export function SidebarSelectItem({
  label,
  icon: Icon,
  value,
  valueLabel,
  onValueChange,
  density = 'default',
  children
}: SidebarSelectItemProps) {
  const tone = getSidebarItemTone(density);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn(
          'h-auto w-full rounded-xl border-0 bg-transparent font-medium text-gray-600 shadow-none hover:bg-gray-200/60 focus:ring-0',
          tone.row
        )}
      >
        <div className={cn('flex min-w-0 items-center', tone.gap)}>
          <Icon className={cn(tone.icon, 'text-gray-400')} />
          <span className="text-left">{label}</span>
        </div>
        <span className={cn('ml-auto text-gray-500', tone.value)}>{valueLabel}</span>
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}
