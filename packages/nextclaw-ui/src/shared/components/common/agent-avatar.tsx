import { cn } from '@/shared/lib/utils';
import { Bot } from 'lucide-react';

type AgentAvatarProps = {
  agentId: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  className?: string;
};

const PALETTE = [
  ['bg-amber-100', 'text-amber-700'],
  ['bg-emerald-100', 'text-emerald-700'],
  ['bg-blue-100', 'text-blue-700'],
  ['bg-rose-100', 'text-rose-700'],
  ['bg-cyan-100', 'text-cyan-700'],
  ['bg-violet-100', 'text-violet-700']
] as const;

function hashText(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function AgentAvatar({ agentId, displayName, avatarUrl, className }: AgentAvatarProps) {
  const seed = displayName?.trim() || agentId;
  const [bgClass, textClass] = PALETTE[hashText(agentId) % PALETTE.length] ?? PALETTE[0];

  if (avatarUrl?.trim()) {
    return (
      <img
        src={avatarUrl}
        alt={displayName?.trim() || agentId}
        className={cn('rounded-full object-cover', className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold',
        bgClass,
        textClass,
        className
      )}
      aria-label={displayName?.trim() || agentId}
    >
      {agentId.trim().toLowerCase() === 'main' ? (
        <Bot className="h-[55%] w-[55%]" strokeWidth={2.4} />
      ) : (
        (seed.trim() || 'A').slice(0, 1).toUpperCase()
      )}
    </div>
  );
}
