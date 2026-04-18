import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateProfile } from '@/api/client';
import type { AuthResult, UserView } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';

const NEXTCLAW_WEB_ACCOUNT_URL = 'https://platform.nextclaw.io/account';

type Translate = (key: string, params?: Record<string, string | number>) => string;

type Props = {
  token: string;
  user: UserView;
  t: Translate;
  highlight: boolean;
};

function AccountMetaRow(props: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[#e4e0d7] bg-[#f9f8f5] px-4 py-3">
      <p className="text-sm font-medium text-[#656561]">{props.label}</p>
      <p className="text-sm font-semibold text-[#1f1f1d]">{props.value}</p>
    </div>
  );
}

function resolveReadinessTone(hasUsername: boolean): string {
  return hasUsername
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-amber-200 bg-amber-50 text-amber-700';
}

export function AccountSummaryCard({ token, user, t, highlight }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const setToken = useAuthStore((state) => state.setToken);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const hasUsername = Boolean(user.username);
  const usernameInput = usernameDraft.trim();
  const publishScope = hasUsername ? `@${user.username}/*` : t('account.publishScopeMissing');

  const updateProfileMutation = useMutation({
    mutationFn: async (username: string) => await updateProfile(token, { username }),
    onSuccess: (result: AuthResult) => {
      setToken(result.token);
      queryClient.setQueryData(['me', result.token], { user: result.user });
      if (result.token !== token) {
        queryClient.removeQueries({ queryKey: ['me', token], exact: true });
      }
      setUsernameDraft('');
      setFeedback(t('account.messages.usernameSaved'));
    },
    onError: (error: unknown) => {
      setFeedback(error instanceof Error ? error.message : t('account.messages.usernameSaveFailed'));
    }
  });

  return (
    <Card
      className={cn(
        'space-y-5 rounded-2xl p-5',
        highlight ? 'border-brand-200 shadow-[0_16px_40px_rgba(95,107,67,0.12)]' : null
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>{t('account.title')}</CardTitle>
            <span
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]',
                resolveReadinessTone(hasUsername)
              )}
            >
              {hasUsername ? t('account.readiness.ready') : t('account.readiness.missing')}
            </span>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-[#656561]">
            {highlight ? t('account.highlightDescription') : t('account.description')}
          </p>
        </div>
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-2xl border border-[#e4e0d7] bg-white px-4 py-2 text-sm font-medium text-[#656561] transition-colors hover:bg-[#f9f8f5]"
        >
          {t('account.actions.openInstances')}
        </a>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AccountMetaRow label={t('account.fields.email')} value={user.email} />
        <AccountMetaRow label={t('account.fields.username')} value={user.username ?? t('account.values.notSet')} />
        <AccountMetaRow label={t('account.fields.role')} value={t(`app.roles.${user.role}`)} />
        <AccountMetaRow label={t('account.fields.publishScope')} value={publishScope} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <AccountMetaRow label={t('account.fields.webAddress')} value={NEXTCLAW_WEB_ACCOUNT_URL} />
        <AccountMetaRow label={t('account.fields.cliFallback')} value="nextclaw account set-username <username>" />
      </div>

      {!hasUsername ? (
        <div className="rounded-[24px] border border-amber-200 bg-[#fbf6eb] p-4">
          <p className="text-sm font-semibold text-[#1f1f1d]">{t('account.missingTitle')}</p>
          <p className="mt-2 text-sm leading-6 text-[#656561]">{t('account.missingDescription')}</p>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <Input
              value={usernameDraft}
              onChange={(event) => setUsernameDraft(event.target.value)}
              placeholder={t('account.usernamePlaceholder')}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="h-12 rounded-2xl px-4"
            />
            <Button
              className="h-12 rounded-2xl px-5"
              disabled={!usernameInput || updateProfileMutation.isPending}
              onClick={() => updateProfileMutation.mutate(usernameInput)}
            >
              {updateProfileMutation.isPending ? t('account.actions.savingUsername') : t('account.actions.saveUsername')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/70 p-4 text-sm leading-6 text-[#656561]">
          <p className="font-semibold text-[#1f1f1d]">{t('account.readyTitle')}</p>
          <p className="mt-2">{t('account.readyDescription', { scope: publishScope })}</p>
          <p className="mt-2">{t('account.lockedHelp')}</p>
        </div>
      )}

      {feedback ? <p className="text-sm text-[#656561]">{feedback}</p> : null}
    </Card>
  );
}
