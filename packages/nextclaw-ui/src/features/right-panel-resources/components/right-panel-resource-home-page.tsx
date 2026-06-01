import type { ReactNode } from 'react';
import {
  BookOpen,
  Boxes,
  BrainCircuit,
  Grid3X3,
  Wrench,
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
  icon: ReactNode;
};

const HOME_ITEM_VIEW_BY_ID: Record<string, RightPanelResourceHomeItem> = {
  apps: {
    accentClassName: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    icon: <Boxes className="h-5 w-5" />,
  },
  'service-apps': {
    accentClassName: 'bg-sky-50 text-sky-700 border-sky-100',
    icon: <Grid3X3 className="h-5 w-5" />,
  },
  docs: {
    accentClassName: 'bg-amber-50 text-amber-700 border-amber-100',
    icon: <BookOpen className="h-5 w-5" />,
  },
  'skill-marketplace': {
    accentClassName: 'bg-rose-50 text-rose-700 border-rose-100',
    icon: <BrainCircuit className="h-5 w-5" />,
  },
  'mcp-marketplace': {
    accentClassName: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    icon: <Wrench className="h-5 w-5" />,
  },
};

function resolveHomeItemView(item: RightPanelResourceHomeNavigationItem): RightPanelResourceHomeItem {
  return HOME_ITEM_VIEW_BY_ID[item.id] ?? {
    accentClassName: 'bg-gray-50 text-gray-700 border-gray-100',
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
    <div className="h-full overflow-auto bg-background px-5 py-6">
      <div className="mx-auto w-full max-w-[640px]">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(88px,1fr))] gap-x-3 gap-y-5">
          {items.map((item) => {
            const view = resolveHomeItemView(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openTarget(item.target)}
                className="group flex min-h-[82px] flex-col items-center gap-2 rounded-lg px-2 py-2 text-center transition-colors hover:bg-white/80"
              >
                <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border shadow-[0_1px_2px_rgba(30,20,10,0.04)] transition-transform group-hover:scale-[1.03]', view.accentClassName)}>
                  {view.icon}
                </span>
                <span className="min-w-0 max-w-full">
                  <span className="line-clamp-2 block text-xs font-medium leading-snug text-gray-800">{item.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
