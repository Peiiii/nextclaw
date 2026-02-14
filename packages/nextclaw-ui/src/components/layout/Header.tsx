import { Bell, Search } from 'lucide-react';

interface HeaderProps {
  title?: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  return (
    <header className="h-16 bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-200 flex items-center justify-between px-6 transition-all duration-base">
      <div className="flex items-center gap-4">
        {title && (
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {description && (
              <p className="text-xs text-gray-500">{description}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors duration-fast">
          <Search className="h-4 w-4" />
        </button>
        <button className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors duration-fast relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
        </button>
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center">
          <span className="text-xs font-semibold text-white">N</span>
        </div>
      </div>
    </header>
  );
}
