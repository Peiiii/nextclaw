import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="h-screen flex bg-white font-sans text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 overflow-hidden relative">
        <main className="flex-1 overflow-auto custom-scrollbar p-10">
          <div className="max-w-6xl mx-auto animate-fade-in h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
