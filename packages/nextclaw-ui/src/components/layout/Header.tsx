import { StatusBadge } from '@/components/common/StatusBadge';
import { useUiStore } from '@/stores/ui.store';

export function Header() {
  const { connectionStatus } = useUiStore();

  return (
    <header className="h-14 border-b px-6 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">nextclaw</h1>
        <span className="text-sm text-muted-foreground">系统配置</span>
      </div>
      <StatusBadge status={connectionStatus} />
    </header>
  );
}
