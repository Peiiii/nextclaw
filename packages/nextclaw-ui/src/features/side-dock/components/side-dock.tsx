import { AppWindow, BookOpen, Boxes, Github, PanelRightClose, Plus, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SideDockManager } from '@/features/side-dock/managers/side-dock.manager';
import {
  getSideDockBuiltInItems,
  SIDE_DOCK_GITHUB_PROJECT_ITEM_ID,
} from '@/features/side-dock/configs/side-dock-built-in-items.config';
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
import { useConfirmDialog } from '@/shared/hooks/use-confirm-dialog';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

type SideDockProps = {
  manager: SideDockManager;
};

const SIDE_DOCK_ICON_COMPONENTS: Record<SideDockIconName, LucideIcon> = {
  apps: Boxes,
  docs: BookOpen,
  github: Github,
  'new-tab': Plus,
  'panel-app': AppWindow,
  'service-apps': AppWindow,
};

const SIDE_DOCK_UTILITY_ITEM_IDS = new Set<string>([SIDE_DOCK_GITHUB_PROJECT_ITEM_ID]);

const SIDE_DOCK_EMOJI_ICON_PATTERN = /^\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*$/u;

function isSideDockEmojiIcon(value: string): boolean {
  return SIDE_DOCK_EMOJI_ICON_PATTERN.test(value.trim());
}

function SideDockItemIconView({ icon }: { icon: SideDockItemIcon }) {
  if (icon.type === 'url') {
    return <img src={icon.url} alt="" className="h-5 w-5 rounded object-cover" />;
  }
  if (icon.type === 'text') {
    if (isSideDockEmojiIcon(icon.value)) {
      return (
        <span className="flex h-7 w-7 items-center justify-center text-[20px] leading-none" aria-hidden="true">
          {icon.value}
        </span>
      );
    }
    return (
      <span className="max-w-7 truncate text-center text-[13px] font-semibold leading-none" aria-hidden="true">
        {icon.value}
      </span>
    );
  }

  const Icon = SIDE_DOCK_ICON_COMPONENTS[icon.name];
  return <Icon className="h-5 w-5" aria-hidden="true" />;
}

function SideDockButton({
  active,
  item,
  onOpen,
  onUnpin,
}: {
  active: boolean;
  item: SideDockItem;
  onOpen: (item: SideDockItem) => void;
  onUnpin: (item: SideDockItem) => void;
}) {
  const { label } = item;

  return (
    <Tooltip>
      <div className="group relative">
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
        {item.removable ? (
          <button
            type="button"
            aria-label={t('sideDockUnpinItem')}
            title={t('sideDockUnpinItem')}
            onClick={(event) => {
              event.stopPropagation();
              onUnpin(item);
            }}
            className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm ring-1 ring-border/70 transition-colors hover:bg-muted hover:text-foreground group-hover:flex focus-visible:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

function SideDockActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          data-side-dock-action="hide"
          onClick={onClick}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors',
            'hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

function normalizeSideDockUri(uri?: string): string {
  return uri?.trim() ?? '';
}

function getSideDockResourceUri(item: SideDockItem): string | null {
  return item.target.type === 'right-panel-resource' ? item.target.uri : null;
}

function isSideDockItemActive(
  item: SideDockItem,
  isDocBrowserOpen: boolean,
  currentTab?: DocBrowserTab,
  hasExactActiveItem = false,
): boolean {
  if (!isDocBrowserOpen || !currentTab) {
    return false;
  }
  const itemUri = normalizeSideDockUri(getSideDockResourceUri(item) ?? undefined);
  if (!itemUri) {
    return false;
  }
  const currentResourceUri = normalizeSideDockUri(currentTab.resourceUri);
  if (
    (currentResourceUri && currentResourceUri === itemUri)
    || normalizeSideDockUri(currentTab.currentUrl) === itemUri
  ) {
    return true;
  }
  if (hasExactActiveItem) {
    return false;
  }
  return item.id === 'docs' && currentTab.kind === 'docs';
}

function hasExactActiveSideDockItem(items: SideDockItem[], currentTab?: DocBrowserTab): boolean {
  if (!currentTab) {
    return false;
  }
  const currentResourceUri = normalizeSideDockUri(currentTab.resourceUri);
  const currentUrl = normalizeSideDockUri(currentTab.currentUrl);
  return items.some((item) => {
    const itemUri = normalizeSideDockUri(getSideDockResourceUri(item) ?? undefined);
    return itemUri === currentResourceUri || itemUri === currentUrl;
  });
}

function isSideDockUtilityItem(item: SideDockItem): boolean {
  return SIDE_DOCK_UTILITY_ITEM_IDS.has(item.id);
}

export function SideDock({ manager }: SideDockProps) {
  const pinnedItems = useSideDockStore((state) => state.pinnedItems);
  const setSideDockVisible = useSideDockStore((state) => state.setVisible);
  const { currentTab, isOpen } = useDocBrowser();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const items = mergeSideDockItems(getSideDockBuiltInItems(), pinnedItems);
  const mainItems = items.filter((item) => !isSideDockUtilityItem(item));
  const utilityItems = items.filter(isSideDockUtilityItem);
  const hasExactActiveItem = hasExactActiveSideDockItem(items, currentTab);
  const handleHideSideDock = async (): Promise<void> => {
    const confirmed = await confirm({
      title: t('sideDockHideConfirmTitle'),
      description: t('sideDockHideConfirmDescription'),
      confirmLabel: t('sideDockHideConfirmAction'),
      cancelLabel: t('cancel'),
    });
    if (confirmed) {
      setSideDockVisible(false);
    }
  };

  return (
    <TooltipProvider delayDuration={250}>
      <aside
        data-testid="side-dock"
        className="z-30 flex h-full w-14 shrink-0 flex-col items-center gap-1 border-l border-border/60 bg-background/95 px-2 py-3"
      >
        <div className="flex w-full flex-col items-center gap-1">
          {mainItems.map((item) => (
            <SideDockButton
              key={item.id}
              active={isSideDockItemActive(item, isOpen, currentTab, hasExactActiveItem)}
              item={item}
              onOpen={manager.openItem}
              onUnpin={(dockItem) => manager.unpinItem(dockItem.id)}
            />
          ))}
        </div>
        {utilityItems.length > 0 ? (
          <div data-testid="side-dock-utility" className="mt-auto flex w-full flex-col items-center gap-1">
            {utilityItems.map((item) => (
              <SideDockButton
                key={item.id}
                active={isSideDockItemActive(item, isOpen, currentTab, hasExactActiveItem)}
                item={item}
                onOpen={manager.openItem}
                onUnpin={(dockItem) => manager.unpinItem(dockItem.id)}
              />
            ))}
            <SideDockActionButton
              icon={PanelRightClose}
              label={t('sideDockHide')}
              onClick={() => {
                void handleHideSideDock();
              }}
            />
          </div>
        ) : null}
        <ConfirmDialog />
      </aside>
    </TooltipProvider>
  );
}
