import { useState } from 'react';
import { cn } from '@/shared/lib/utils';

export function AppArtwork({
  className,
  icon,
  name,
}: {
  className?: string;
  icon?: string;
  name: string;
}) {
  const [failedIcon, setFailedIcon] = useState<string>();
  const imageIcon = isImageIcon(icon);
  const imageFailed = failedIcon === icon;

  return (
    <span className={cn(
      'relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[13px] bg-gradient-to-br from-violet-500/15 via-primary/10 to-emerald-500/15 text-sm font-semibold text-foreground ring-1 ring-black/[0.04] dark:ring-white/[0.06]',
      className,
    )}>
      {imageIcon && !imageFailed ? (
        <img
          src={icon}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailedIcon(icon)}
        />
      ) : icon && !imageIcon ? (
        <span className="text-base leading-none" aria-hidden="true">{icon}</span>
      ) : (
        <span aria-hidden="true">{readInitial(name)}</span>
      )}
    </span>
  );
}

function isImageIcon(icon: string | undefined): icon is string {
  return Boolean(icon) && (
    icon!.startsWith('data:') ||
    icon!.startsWith('/') ||
    icon!.startsWith('http://') ||
    icon!.startsWith('https://')
  );
}

function readInitial(name: string): string {
  return [...name.trim()][0]?.toLocaleUpperCase() ?? 'A';
}
