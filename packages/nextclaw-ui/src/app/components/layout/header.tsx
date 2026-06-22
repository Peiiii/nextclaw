interface HeaderProps {
  title?: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center bg-background/90 px-6 backdrop-blur-sm transition-all duration-base">
      <div className="flex items-center gap-3">
        {title && (
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
