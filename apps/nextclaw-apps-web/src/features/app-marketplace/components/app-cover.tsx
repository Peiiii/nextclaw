import { useState, type CSSProperties } from "react";

export function AppCover({
  accentColor,
  className = "",
  coverUrl,
  name,
}: {
  accentColor?: string;
  className?: string;
  coverUrl?: string;
  name: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const visibleCover = coverUrl && failedUrl !== coverUrl ? coverUrl : undefined;
  return (
    <div
      className={`app-cover ${className}`.trim()}
      style={{ "--app-accent": accentColor ?? "#78716c" } as CSSProperties}
    >
      {visibleCover ? (
        <img
          src={visibleCover}
          alt={`${name} 应用封面`}
          loading="lazy"
          onError={() => setFailedUrl(visibleCover)}
        />
      ) : (
        <div className="app-cover__fallback" aria-label={`${name} 暂无封面`}>
          <span>{name.trim().slice(0, 1)}</span>
        </div>
      )}
    </div>
  );
}
