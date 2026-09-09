import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { login } from '@/api/platform-client.utils';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/auth';

export function LoginPage(): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((state) => state.setUser);

  const mutation = useMutation({
    mutationFn: async () => await login(email, password),
    onSuccess: (result) => {
      setToken(result.token);
      setUser(result.user);
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to continue');
    }
  });

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-10">
        <Card className="w-full space-y-5 p-6">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-700">NextClaw Admin</p>
            <CardTitle>登录管理后台</CardTitle>
            <p className="text-sm text-slate-500">仅管理员账号可进入本网站。普通用户请使用独立用户前端站点。</p>
          </div>

          <div className="space-y-3">
            <Input type="email" placeholder="邮箱" value={email} onChange={(event) => setEmail(event.target.value)} />
            <Input type="password" placeholder="密码（至少 8 位）" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <Button
            className="h-10 w-full"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || email.trim().length === 0 || password.trim().length < 8}
          >
            {mutation.isPending ? '处理中...' : '登录管理后台'}
          </Button>
        </Card>
      </div>
    </main>
  );
}
