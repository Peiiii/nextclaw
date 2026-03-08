import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { login, register } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/auth';

export function LoginPage(): JSX.Element {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((state) => state.setUser);

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === 'register') {
        return await register(email, password);
      }
      return await login(email, password);
    },
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
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-700">NextClaw Platform</p>
            <CardTitle>{mode === 'register' ? '注册平台账号' : '登录平台'}</CardTitle>
            <p className="text-sm text-slate-500">使用邮箱与密码继续。</p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-100 p-1">
            <Button
              variant={mode === 'login' ? 'primary' : 'ghost'}
              onClick={() => {
                setMode('login');
                setError(null);
              }}
            >
              登录
            </Button>
            <Button
              variant={mode === 'register' ? 'primary' : 'ghost'}
              onClick={() => {
                setMode('register');
                setError(null);
              }}
            >
              注册
            </Button>
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
            {mutation.isPending ? '处理中...' : mode === 'register' ? '注册并进入平台' : '登录'}
          </Button>
        </Card>
      </div>
    </main>
  );
}
