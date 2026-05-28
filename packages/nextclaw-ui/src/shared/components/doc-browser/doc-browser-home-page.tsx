import type { ReactNode } from 'react';
import {
  BookOpen,
  Boxes,
  BrainCircuit,
  Grid3X3,
  Wrench,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DOCS_DEFAULT_BASE_URL,
  type DocBrowserContextValue,
} from './doc-browser-context';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

type DocBrowserHomePageProps = {
  open: DocBrowserContextValue['open'];
};

type DocBrowserHomeItem = {
  accentClassName: string;
  icon: ReactNode;
  label: string;
  id: string;
  onSelect: () => void;
};

export function DocBrowserHomePage({ open }: DocBrowserHomePageProps) {
  const navigate = useNavigate();
  const items: DocBrowserHomeItem[] = [
    {
      accentClassName: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      icon: <Boxes className="h-5 w-5" />,
      id: 'apps',
      label: t('appsTitle'),
      onSelect: () => open('nextclaw://apps', {
        kind: 'apps',
        title: t('appsTitle'),
        dedupeKey: 'apps',
      }),
    },
    {
      accentClassName: 'bg-sky-50 text-sky-700 border-sky-100',
      icon: <Grid3X3 className="h-5 w-5" />,
      id: 'service-apps',
      label: t('serviceAppsTitle'),
      onSelect: () => open('nextclaw://apps?tab=service-apps', {
        kind: 'apps',
        title: t('serviceAppsTitle'),
        dedupeKey: 'apps',
      }),
    },
    {
      accentClassName: 'bg-amber-50 text-amber-700 border-amber-100',
      icon: <BookOpen className="h-5 w-5" />,
      id: 'docs',
      label: t('docBrowserHelp'),
      onSelect: () => open(DOCS_DEFAULT_BASE_URL, {
        kind: 'docs',
        newTab: true,
        title: 'Docs',
      }),
    },
    {
      accentClassName: 'bg-rose-50 text-rose-700 border-rose-100',
      icon: <BrainCircuit className="h-5 w-5" />,
      id: 'skill-marketplace',
      label: t('marketplaceSkillsPageTitle'),
      onSelect: () => navigate('/marketplace/skills'),
    },
    {
      accentClassName: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      icon: <Wrench className="h-5 w-5" />,
      id: 'mcp-marketplace',
      label: t('marketplaceMcpPageTitle'),
      onSelect: () => navigate('/marketplace/mcp'),
    },
  ];

  return (
    <div className="h-full overflow-auto bg-[#fbfaf7] px-5 py-6">
      <div className="mx-auto w-full max-w-[640px]">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(88px,1fr))] gap-x-3 gap-y-5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onSelect}
              className="group flex min-h-[82px] flex-col items-center gap-2 rounded-lg px-2 py-2 text-center transition-colors hover:bg-white/80"
            >
              <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-[0_1px_2px_rgba(30,20,10,0.04)] transition-transform group-hover:scale-[1.03]', item.accentClassName)}>
                {item.icon}
              </span>
              <span className="min-w-0 max-w-full">
                <span className="line-clamp-2 block text-xs font-medium leading-snug text-gray-800">{item.label}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
