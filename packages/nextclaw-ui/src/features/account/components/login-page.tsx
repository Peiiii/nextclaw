import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { useLoginAuth } from '@/hooks/use-auth';
import { t } from '@/shared/lib/i18n';

type LoginPageProps = {
  username?: string;
};

export function LoginPage({ username }: LoginPageProps) {
  const loginMutation = useLoginAuth();
  const [formUsername, setFormUsername] = useState(username ?? '');
  const [password, setPassword] = useState('');
  const canSubmit = formUsername.trim().length > 0 && password.length > 0 && !loginMutation.isPending;

  const handleSubmit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!canSubmit) {
      return;
    }
    loginMutation.mutate({
      username: formUsername.trim(),
      password
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary px-6 py-10">
      <Card hover={false} className="w-full max-w-md shadow-card-hover">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">{t('authBrand')}</p>
          <CardTitle className="text-2xl">{t('authLoginTitle')}</CardTitle>
          <CardDescription>{t('authLoginDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-800">{t('authUsername')}</label>
            <Input
              value={formUsername}
              onChange={(event) => setFormUsername(event.target.value)}
              placeholder={t('authUsernamePlaceholder')}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-800">{t('authPassword')}</label>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('authPasswordPlaceholder')}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={!canSubmit}
          >
            {loginMutation.isPending ? t('authLoggingIn') : t('authLoginAction')}
          </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
