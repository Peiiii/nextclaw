interface HeaderProps {
  title?: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  return (
    <header className="h-14 bg-white/90 backdrop-blur-sm sticky top-0 z-10 flex items-center px-6 transition-all duration-base">
      <div className="flex items-center gap-3">
        {title && (
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>
            {description && (
              <p className="text-xs text-gray-400 mt-0.5">{description}</p>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
