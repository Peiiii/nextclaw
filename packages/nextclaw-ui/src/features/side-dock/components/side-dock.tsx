import { AppWindow, BookOpen, Boxes, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SideDockManager } from '@/features/side-dock/managers/side-dock.manager';
import { SIDE_DOCK_BUILT_IN_ITEMS } from '@/features/side-dock/configs/side-dock-built-in-items.config';
import { useSideDockStore } from '@/features/side-dock/stores/side-dock.store';
import type {
  SideDockIconName,
  SideDockItem,
  SideDockItemIcon,
} from '@/features/side-dock/types/side-dock.types';
import { mergeSideDockItems } from '@/features/side-dock/utils/side-dock-item.utils';
import {
  useDocBrowser,
  type DocBrowserTab,
} from '@/shared/components/doc-browser/doc-browser-context';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

type SideDockProps = {
  manager: SideDockManager;
};

const SIDE_DOCK_ICON_COMPONENTS: Record<SideDockIconName, LucideIcon> = {
  apps: Boxes,
  docs: BookOpen,
  'new-tab': Plus,
  'service-apps': AppWindow,
};

function SideDockItemIconView({ icon }: { icon: SideDockItemIcon }) {
  if (icon.type === 'url') {
    return <img src={icon.url} alt="" className="h-5 w-5 rounded object-cover" />;
  }

  const Icon = SIDE_DOCK_ICON_COMPONENTS[icon.name];
  return <Icon className="h-5 w-5" aria-hidden="true" />;
}

function SideDockButton({
  active,
  item,
  onOpen,
}: {
  active: boolean;
  item: SideDockItem;
  onOpen: (item: SideDockItem) => void;
}) {
  const label = t(item.labelKey);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          data-side-dock-item-id={item.id}
          onClick={() => onOpen(item)}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors',
            'hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            active
              ? 'bg-primary/10 text-primary'
              : 'bg-transparent',
          )}
        >
          <SideDockItemIconView icon={item.icon} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

function isSideDockItemActive(
  item: SideDockItem,
  isDocBrowserOpen: boolean,
  currentTab?: DocBrowserTab,
): boolean {
  if (!isDocBrowserOpen || !currentTab) {
    return false;
  }
  if (currentTab.currentUrl === item.target.uri) {
    return true;
  }
  return item.id === 'docs' && currentTab.kind === 'docs';
}

export function SideDock({ manager }: SideDockProps) {
  const pinnedItems = useSideDockStore((state) => state.pinnedItems);
  const { currentTab, isOpen } = useDocBrowser();
  const items = mergeSideDockItems(SIDE_DOCK_BUILT_IN_ITEMS, pinnedItems);

  return (
    <TooltipProvider delayDuration={250}>
      <aside
        data-testid="side-dock"
        className="z-30 flex h-full w-14 shrink-0 flex-col items-center gap-1 border-l border-border/60 bg-background/95 px-2 py-3"
      >
        {items.map((item) => (
          <SideDockButton
            key={item.id}
            active={isSideDockItemActive(item, isOpen, currentTab)}
            item={item}
            onOpen={manager.openItem}
          />
        ))}
      </aside>
    </TooltipProvider>
  );
}
