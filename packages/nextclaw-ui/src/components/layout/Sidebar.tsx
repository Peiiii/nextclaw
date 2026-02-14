import { useUiStore } from '@/stores/ui.store';
import { cn } from '@/lib/utils';
import { Cpu, MessageSquare, Sparkles } from 'lucide-react';

const navItems = [
  {
    id: 'model' as const,
    label: 'Models',
    icon: Cpu,
  },
  {
    id: 'providers' as const,
    label: 'Providers',
    icon: Sparkles,
  },
  {
    id: 'channels' as const,
    label: 'Channels',
    icon: MessageSquare,
  }
];

export function Sidebar() {
  const { activeTab, setActiveTab } = useUiStore();

  return (
    <aside className="w-[240px] bg-transparent flex flex-col h-full py-6 px-4">
      {/* Logo Area */}
      <div className="px-3 mb-8">
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="h-7 w-7 rounded-lg overflow-hidden flex items-center justify-center transition-transform duration-fast group-hover:scale-110">
            <img src="/logo.svg" alt="NextClaw Logo" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">nextclaw</h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <li key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    'group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-fast',
                    isActive
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <Icon className={cn(
                    'h-4 w-4 transition-transform duration-fast group-hover:scale-110',
                    isActive ? 'text-primary' : 'text-gray-500'
                  )} />
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
