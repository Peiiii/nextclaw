import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMe } from '@/api/client';
import { Button } from '@/components/ui/button';
import { LoginPage } from '@/pages/LoginPage';
import { UserDashboardPage } from '@/pages/UserDashboardPage';
import { useAuthStore } from '@/store/auth';

export default function App(): JSX.Element {
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const meQuery = useQuery({
    queryKey: ['me', token],
    queryFn: async () => {
      if (!token) {
        throw new Error('No token');
      }
      return await fetchMe(token);
    },
    enabled: Boolean(token)
  });

  useEffect(() => {
    if (meQuery.data?.user) {
      setUser(meQuery.data.user);
    }
  }, [meQuery.data, setUser]);

  useEffect(() => {
    if (meQuery.error) {
      logout();
    }
  }, [meQuery.error, logout]);

  if (!token) {
    return <LoginPage />;
  }

  if (meQuery.isLoading) {
    return <main className="p-6 text-sm text-slate-500">加载登录态...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-700">NextClaw Platform Console</p>
            <p className="text-sm text-slate-500">{user?.email ?? ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => logout()}>退出</Button>
          </div>
        </header>

        <UserDashboardPage token={token} />
      </div>
    </main>
  );
}
