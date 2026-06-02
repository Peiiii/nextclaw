import type { ReactNode } from 'react';
import {
  BookOpen,
  Boxes,
  BrainCircuit,
  Grid3X3,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DocBrowserContextValue } from '@/shared/components/doc-browser/doc-browser-context';
import { cn } from '@/shared/lib/utils';
import {
  getRightPanelResourceHomeNavigationItems,
} from '@/features/right-panel-resources/configs/right-panel-resource-routes.config';
import type {
  RightPanelResourceHomeNavigationItem,
  RightPanelResourceNavigationTarget,
} from '@/features/right-panel-resources/types/right-panel-resource.types';

type RightPanelResourceHomePageProps = {
  open: DocBrowserContextValue['open'];
};

type RightPanelResourceHomeItem = {
  accentClassName: string;
  hoverAccentClassName: string;
  icon: ReactNode;
};

const HOME_ITEM_VIEW_BY_ID: Record<string, RightPanelResourceHomeItem> = {
  apps: {
    accentClassName: 'bg-emerald-50 text-emerald-700',
    hoverAccentClassName: 'group-hover:bg-emerald-100',
    icon: <Boxes className="h-5 w-5" />,
  },
  'service-apps': {
    accentClassName: 'bg-sky-50 text-sky-700',
    hoverAccentClassName: 'group-hover:bg-sky-100',
    icon: <Grid3X3 className="h-5 w-5" />,
  },
  docs: {
    accentClassName: 'bg-amber-50 text-amber-700',
    hoverAccentClassName: 'group-hover:bg-amber-100',
    icon: <BookOpen className="h-5 w-5" />,
  },
  'skill-marketplace': {
    accentClassName: 'bg-rose-50 text-rose-700',
    hoverAccentClassName: 'group-hover:bg-rose-100',
    icon: <BrainCircuit className="h-5 w-5" />,
  },
};

function resolveHomeItemView(item: RightPanelResourceHomeNavigationItem): RightPanelResourceHomeItem {
  return HOME_ITEM_VIEW_BY_ID[item.id] ?? {
    accentClassName: 'bg-gray-50 text-gray-700',
    hoverAccentClassName: 'group-hover:bg-gray-100',
    icon: <Boxes className="h-5 w-5" />,
  };
}

export function RightPanelResourceHomePage({ open }: RightPanelResourceHomePageProps) {
  const navigate = useNavigate();
  const items = getRightPanelResourceHomeNavigationItems();

  const openTarget = (target: RightPanelResourceNavigationTarget) => {
    if (target.type === 'app-route') {
      navigate(target.path);
      return;
    }
    open(target.uri, target.options);
  };

  return (
    <div className="h-full overflow-auto bg-background px-4 py-5">
      <div className="mx-auto w-full max-w-[520px]">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(76px,1fr))] gap-x-2 gap-y-4">
          {items.map((item) => {
            const view = resolveHomeItemView(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openTarget(item.target)}
                className="group flex min-h-[68px] flex-col items-center gap-1.5 rounded-md px-1.5 py-1.5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors', view.accentClassName, view.hoverAccentClassName)}>
                  {view.icon}
                </span>
                <span className="line-clamp-2 min-w-0 max-w-full text-xs font-medium leading-snug text-gray-700 transition-colors group-hover:text-gray-900">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
