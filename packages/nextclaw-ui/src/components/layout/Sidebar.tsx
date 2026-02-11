import { useUiStore } from '@/stores/ui.store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Cpu, Server, MessageSquare, Settings } from 'lucide-react';

const navItems = [
  { id: 'model' as const, label: t('model'), icon: Cpu },
  { id: 'providers' as const, label: t('providers'), icon: Server },
  { id: 'channels' as const, label: t('channels'), icon: MessageSquare },
  { id: 'ui' as const, label: t('uiConfig'), icon: Settings }
];

export function Sidebar() {
  const { activeTab, setActiveTab } = useUiStore();

  return (
    <nav className="w-56 border-r bg-muted/30 p-4">
      <ul className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <li key={item.id}>
              <button
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
