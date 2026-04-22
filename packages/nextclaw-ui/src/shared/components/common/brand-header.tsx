import { useAppMeta } from '@/shared/hooks/use-config';
import type { ReactNode } from 'react';
import { RuntimeStatusEntry } from '@/app/components/layout/runtime-status-entry';

type BrandHeaderProps = {
  className?: string;
  suffix?: ReactNode;
};

export function BrandHeader({ className, suffix }: BrandHeaderProps) {
  const { data } = useAppMeta();
  const productName = data?.name ?? 'NextClaw';
  const productVersion = data?.productVersion?.trim();
  const resolvedSuffix = suffix ?? <RuntimeStatusEntry />;

  return (
    <div className={className ?? 'flex items-center gap-2.5'}>
      <div className="h-7 w-7 rounded-lg overflow-hidden flex items-center justify-center">
        <img src="/logo.svg" alt={productName} className="h-full w-full object-contain" />
      </div>
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-gray-800">{productName}</span>
        {productVersion ? <span className="text-[13px] font-medium text-gray-500">v{productVersion}</span> : null}
        {resolvedSuffix ? <span className="inline-flex items-center shrink-0">{resolvedSuffix}</span> : null}
      </div>
    </div>
  );
}
