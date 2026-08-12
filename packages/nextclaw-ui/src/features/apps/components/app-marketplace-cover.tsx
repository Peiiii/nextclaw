import { useState, type CSSProperties } from 'react';
import { cn } from '@/shared/lib/utils';

const COVER_PREVIEW_LABEL = import.meta.env.VITE_APP_MARKETPLACE_PREVIEW_LABEL;

export function AppMarketplaceCover({
  accentColor,
  className,
  coverPreview,
  coverUrl,
  name,
}: {
  accentColor?: string;
  className?: string;
  coverPreview?: boolean;
  coverUrl?: string;
  name: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const visibleCover = coverUrl && failedUrl !== coverUrl ? coverUrl : undefined;
  return (
    <span
      className={cn(
        'relative block aspect-[8/5] overflow-hidden rounded-2xl bg-muted ring-1 ring-black/[0.05] dark:ring-white/[0.07]',
        className,
      )}
      style={{ '--app-accent': accentColor ?? '#78716c' } as CSSProperties}
    >
      {visibleCover ? (
        <>
          <img
            src={visibleCover}
            alt={`${name} app cover`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.015]"
            loading="lazy"
            onError={() => setFailedUrl(visibleCover)}
          />
          {coverPreview && COVER_PREVIEW_LABEL ? (
            <span className="absolute bottom-2 right-2 rounded-full bg-background/75 px-2 py-1 text-[9px] font-medium text-foreground/70 shadow-sm ring-1 ring-black/[0.06] backdrop-blur-md">
              {COVER_PREVIEW_LABEL}
            </span>
          ) : null}
        </>
      ) : (
        <span
          aria-label={`${name} 暂无封面`}
          className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_25%,color-mix(in_srgb,var(--app-accent)_28%,transparent),transparent_50%),linear-gradient(145deg,var(--muted),var(--background))]"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/65 text-xl font-semibold text-foreground/65 shadow-sm ring-1 ring-black/[0.05] backdrop-blur-sm">
            {readCoverMonogram(name)}
          </span>
        </span>
      )}
    </span>
  );
}

function readCoverMonogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words.slice(0, 2).map((word) => word[0]).join('').toLocaleUpperCase();
  }
  return [...(words[0] ?? '?')].slice(0, 1).join('').toLocaleUpperCase();
}
