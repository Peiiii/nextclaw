import { useState, useEffect } from "react";

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    window.nextclawDesktop?.window.isMaximized().then(setIsMaximized);

    const unsubscribe = window.nextclawDesktop?.window.onMaximizedChanged((maximized: boolean) => {
      setIsMaximized(maximized);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleMinimize = () => {
    window.nextclawDesktop?.window.minimize();
  };

  const handleMaximize = () => {
    window.nextclawDesktop?.window.maximize();
  };

  const handleClose = () => {
    window.nextclawDesktop?.window.close();
  };

  return (
    <div
      className="absolute top-0 left-0 right-0 h-9 z-50 select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div className="absolute right-0 top-0 flex" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button
          onClick={handleMinimize}
          className="w-11 h-9 flex items-center justify-center hover:bg-black/10 transition-colors text-foreground"
          aria-label="Minimize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button
          onClick={handleMaximize}
          className="w-11 h-9 flex items-center justify-center hover:bg-black/10 transition-colors text-foreground"
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="2" y="3.5" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1" />
              <rect x="3.5" y="1" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </button>
        <button
          onClick={handleClose}
          className="w-11 h-9 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors text-foreground"
          aria-label="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.2" />
            <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </div>
  );
}