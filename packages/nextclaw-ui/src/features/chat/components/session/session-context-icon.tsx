import { type SessionContextIcon } from '@/features/chat/utils/session-context.utils';
import { resolveAppResourceUri } from '@/shared/lib/app-resource-uri';
import { LogoBadge } from '@/shared/components/common/logo-badge';
import { getChannelLogo } from '@/shared/lib/logos';
import { cn } from '@/shared/lib/utils';
import { AlarmClock, Bot, HeartPulse } from 'lucide-react';

export function SessionContextIconNode({ icon, className }: { icon: SessionContextIcon; className?: string }) {
  if (icon.kind === 'channel-logo') {
    return <ChannelLogoIcon channel={icon.channel} className={className} />;
  }
  if (icon.kind === 'runtime-image') {
    const runtimeIconSrc = resolveAppResourceUri(icon.src);
    return (
      <LogoBadge
        name={icon.name?.trim() || icon.alt?.trim() || 'runtime'}
        src={runtimeIconSrc ?? undefined}
        className={cn('h-[1.125rem] w-[1.125rem]', className)}
        imgClassName="h-full w-full object-contain"
        fallback={<Bot className={cn('h-3 w-3 text-gray-500', className)} />}
      />
    );
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
      className={cn('h-[1.125rem] w-[1.125rem]', className)}
      imgClassName="h-full w-full object-contain"
      fallback={<Bot className="h-3 w-3 text-gray-500" />}
    />
  );
}
