import { useState } from 'react';
import { cn } from '@/lib/utils';

type LogoBadgeProps = {
  name: string;
  src?: string | null;
  className?: string;
  imgClassName?: string;
  fallback?: React.ReactNode;
};

export function LogoBadge({ name, src, className, imgClassName, fallback }: LogoBadgeProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div className={cn('flex items-center justify-center', className)}>
      {showImage ? (
        <img
          src={src as string}
          alt={`${name} logo`}
          className={cn('h-6 w-6 object-contain', imgClassName)}
          onError={() => setFailed(true)}
          draggable={false}
        />
      ) : (
        fallback ?? (
          <span className="text-lg font-bold uppercase">
            {name.slice(0, 1)}
          </span>
        )
      )}
    </div>
  );
}
