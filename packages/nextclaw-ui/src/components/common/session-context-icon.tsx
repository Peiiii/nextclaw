import { type SessionContextIcon } from '@/lib/session-context.utils';
import { LogoBadge } from '@/components/common/LogoBadge';
import { getChannelLogo } from '@/lib/logos';
import { cn } from '@/lib/utils';
import { AlarmClock, Bot, HeartPulse } from 'lucide-react';

export function SessionContextIconNode({ icon, className }: { icon: SessionContextIcon; className?: string }) {
  if (icon.kind === 'channel-logo') {
    return <ChannelLogoIcon channel={icon.channel} className={className} />;
  }
  if (icon.icon === 'heartbeat') {
    return <HeartPulse className={cn('h-3.5 w-3.5', className)} />;
  }
  return <AlarmClock className={cn('h-3.5 w-3.5', className)} />;
}

function ChannelLogoIcon(
  { channel, className }: { channel: string; className?: string }
) {
  const logoSrc = getChannelLogo(channel);
  return (
    <LogoBadge
      name={channel}
      src={logoSrc}
      className={cn('h-4 w-4 rounded-[4px] border border-gray-200/80 bg-white', className)}
      imgClassName="h-3 w-3 object-contain"
      fallback={<Bot className="h-3 w-3 text-gray-500" />}
    />
  );
}
