import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMe } from '@/api/client';
import { Button } from '@/components/ui/button';
import { LoginPage } from '@/pages/LoginPage';
import { AdminDashboardPage } from '@/pages/AdminDashboardPage';
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
    return <main className="p-6 text-sm text-[#8f8a7d]">加载登录态...</main>;
  }

  const currentUser = meQuery.data?.user ?? user;

  if (currentUser?.role !== 'admin') {
    return (
      <main className="min-h-screen bg-[#f9f8f5] text-[#1f1f1d]">
        <div className="mx-auto flex min-h-screen w-full max-w-xl items-center px-6 py-10">
          <section className="w-full rounded-xl border border-[#e4e0d7] bg-white p-6">
            <h1 className="text-lg font-semibold">仅管理员可访问</h1>
            <p className="mt-2 text-sm text-[#656561]">
              当前账号不是管理员。请使用管理员账号登录独立管理后台。
            </p>
            <div className="mt-4">
              <Button variant="ghost" onClick={() => logout()}>退出并切换账号</Button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f9f8f5] text-[#1f1f1d]">
      <div className="mx-auto w-full max-w-[1680px] px-4 py-4 md:px-5 xl:px-6">
        <AdminDashboardPage token={token} user={currentUser} onLogout={logout} />
      </div>
    </main>
  );
}
