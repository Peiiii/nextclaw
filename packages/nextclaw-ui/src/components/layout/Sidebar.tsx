import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { Cpu, GitBranch, History, MessageSquare, Sparkles } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navItems = [
  {
    target: '/model',
    label: 'Models',
    icon: Cpu,
  },
  {
    target: '/providers',
    label: 'Providers',
    icon: Sparkles,
  },
  {
    target: '/channels',
    label: 'Channels',
    icon: MessageSquare,
  },
  {
    target: '/runtime',
    label: 'Routing & Runtime',
    icon: GitBranch,
  },
  {
    target: '/sessions',
    label: t('sessions'),
    icon: History,
  }
];

export function Sidebar() {
  return (
    <aside className="w-[240px] bg-transparent flex flex-col h-full py-6 px-4">
      {/* Logo Area */}
      <div className="px-3 mb-8">
        <div className="flex items-center gap-2.5 group cursor-pointer">
          <div className="h-7 w-7 rounded-lg overflow-hidden flex items-center justify-center transition-transform duration-fast group-hover:scale-110">
            <img src="/logo.svg" alt="NextClaw" className="h-full w-full object-contain" />
          </div>
          <span className="text-[15px] font-bold bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent tracking-[-0.02em]">NextClaw</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <li key={item.target}>
                <NavLink
                  to={item.target}
                  className={({ isActive }) => cn(
                    'group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-fast',
                    isActive
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={cn(
                        'h-4 w-4 transition-transform duration-fast group-hover:scale-110',
                        isActive ? 'text-primary' : 'text-gray-500'
                      )} />
                      <span className="flex-1 text-left">{item.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
