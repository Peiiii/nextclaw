import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  useAuthStatus,
  useLogoutAuth,
  useSetupAuth,
  useUpdateAuthEnabled,
  useUpdateAuthPassword
} from '@/hooks/use-auth';
import { t } from '@/lib/i18n';
import { toast } from 'sonner';

const MIN_PASSWORD_LENGTH = 8;

function hasValidPasswordLength(password: string): boolean {
  return password.trim().length >= MIN_PASSWORD_LENGTH;
}

function validatePasswordConfirmation(password: string, confirmPassword: string): boolean {
  if (password !== confirmPassword) {
    toast.error(t('authPasswordMismatch'));
    return false;
  }
  return true;
}

function SecurityCardFrame({ children, contentClassName = 'space-y-6' }: { children: ReactNode; contentClassName?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('authSecurityTitle')}</CardTitle>
        <CardDescription>{t('authSecurityDescription')}</CardDescription>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

function RuntimeSecuritySetupSection(props: { setupUsername: string; setSetupUsername: (value: string) => void; setupPassword: string; setSetupPassword: (value: string) => void; setupConfirmPassword: string; setSetupConfirmPassword: (value: string) => void; canSubmitSetup: boolean; isPending: boolean; onSubmit: () => void }) {
  return (
    <SecurityCardFrame contentClassName="space-y-5">
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/70 p-4">
        <p className="text-sm font-medium text-gray-900">{t('authSetupTitle')}</p>
        <p className="mt-1 text-sm text-gray-500">{t('authSetupDescription')}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="auth-setup-username">{t('authUsername')}</Label>
          <Input
            id="auth-setup-username"
            value={props.setupUsername}
            onChange={(event) => props.setSetupUsername(event.target.value)}
            placeholder={t('authUsernamePlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="auth-setup-password">{t('authPassword')}</Label>
          <Input
            id="auth-setup-password"
            type="password"
            value={props.setupPassword}
            onChange={(event) => props.setSetupPassword(event.target.value)}
            placeholder={t('authPasswordPlaceholder')}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="auth-setup-confirm">{t('authConfirmPassword')}</Label>
        <Input
          id="auth-setup-confirm"
          type="password"
          value={props.setupConfirmPassword}
          onChange={(event) => props.setSetupConfirmPassword(event.target.value)}
          placeholder={t('authConfirmPasswordPlaceholder')}
        />
        <p className="text-xs text-gray-500">{t('authPasswordMinLengthHint')}</p>
      </div>
      <Button type="button" disabled={!props.canSubmitSetup} onClick={() => void props.onSubmit()}>
        {props.isPending ? t('authSettingUp') : t('authSetupAction')}
      </Button>
    </SecurityCardFrame>
  );
}

function RuntimeSecurityConfiguredSection(props: { authenticated: boolean; enabled: boolean; username: string | null | undefined; nextPassword: string; setNextPassword: (value: string) => void; nextConfirmPassword: string; setNextConfirmPassword: (value: string) => void; canUpdatePassword: boolean; isUpdatingEnabled: boolean; isUpdatingPassword: boolean; isLoggingOut: boolean; onEnabledChange: (enabled: boolean) => void; onPasswordUpdate: () => void; onLogout: () => void }) {
  return (
    <SecurityCardFrame>
      <div className="rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-900">{t('authStatusLabel')}</p>
            <p className="text-sm text-gray-600">{t('authStatusConfiguredUser').replace('{username}', props.username ?? '')}</p>
            <p className="text-xs text-gray-500">{t('authUsernameFixedHelp')}</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            {props.enabled ? t('enabled') : t('disabled')}
          </span>
        </div>
        <div className="mt-4 flex flex-col gap-4 border-t border-gray-200 pt-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-900">{t('authEnableLabel')}</p>
            <p className="text-xs text-gray-500">{props.enabled ? t('authEnableOnHelp') : t('authEnableOffHelp')}</p>
          </div>
          <Switch
            checked={props.enabled}
            disabled={props.isUpdatingEnabled}
            onCheckedChange={(checked) => {
              void props.onEnabledChange(checked);
            }}
          />
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-900">{t('authPasswordSectionTitle')}</p>
          <p className="text-xs text-gray-500">{t('authPasswordSectionDescription')}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="auth-password-next">{t('authPassword')}</Label>
            <Input
              id="auth-password-next"
              type="password"
              value={props.nextPassword}
              onChange={(event) => props.setNextPassword(event.target.value)}
              placeholder={t('authPasswordPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auth-password-confirm">{t('authConfirmPassword')}</Label>
            <Input
              id="auth-password-confirm"
              type="password"
              value={props.nextConfirmPassword}
              onChange={(event) => props.setNextConfirmPassword(event.target.value)}
              placeholder={t('authConfirmPasswordPlaceholder')}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={!props.canUpdatePassword} onClick={() => void props.onPasswordUpdate()}>
            {props.isUpdatingPassword ? t('authPasswordUpdating') : t('authPasswordAction')}
          </Button>
          {props.enabled && props.authenticated ? (
            <Button type="button" variant="outline" disabled={props.isLoggingOut} onClick={() => void props.onLogout()}>
              {props.isLoggingOut ? t('authLoggingOut') : t('authLogoutAction')}
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-gray-500">{t('authSessionMemoryNotice')}</p>
      </div>
    </SecurityCardFrame>
  );
}

export function RuntimeSecurityCard() {
  const authStatus = useAuthStatus();
  const setupAuth = useSetupAuth();
  const updateAuthEnabled = useUpdateAuthEnabled();
  const updateAuthPassword = useUpdateAuthPassword();
  const logoutAuth = useLogoutAuth();
  const [setupUsername, setSetupUsername] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [nextConfirmPassword, setNextConfirmPassword] = useState('');
  const auth = authStatus.data;
  const canSubmitSetup = setupUsername.trim().length > 0 && hasValidPasswordLength(setupPassword) && setupPassword === setupConfirmPassword && !setupAuth.isPending;
  const canUpdatePassword = hasValidPasswordLength(nextPassword) && nextPassword === nextConfirmPassword && !updateAuthPassword.isPending;

  const handleSetup = async () => {
    if (!validatePasswordConfirmation(setupPassword, setupConfirmPassword)) {
      return;
    }
    try {
      await setupAuth.mutateAsync({ username: setupUsername.trim(), password: setupPassword });
      setSetupPassword('');
      setSetupConfirmPassword('');
    } catch {
      // handled by mutation toast
    }
  };

  const handlePasswordUpdate = async () => {
    if (!validatePasswordConfirmation(nextPassword, nextConfirmPassword)) {
      return;
    }
    try {
      await updateAuthPassword.mutateAsync({ password: nextPassword });
      setNextPassword('');
      setNextConfirmPassword('');
    } catch {
      // handled by mutation toast
    }
  };

  const handleEnabledChange = async (enabled: boolean) => {
    try {
      await updateAuthEnabled.mutateAsync({ enabled });
    } catch {
      // handled by mutation toast
    }
  };

  const handleLogout = async () => {
    try {
      await logoutAuth.mutateAsync();
    } catch {
      // handled by mutation toast
    }
  };

  if (authStatus.isLoading && !auth) {
    return <SecurityCardFrame contentClassName="text-sm text-gray-500">{t('loading')}</SecurityCardFrame>;
  }
  if (authStatus.isError || !auth) {
    return (
      <SecurityCardFrame contentClassName="space-y-4">
        <p className="text-sm text-gray-500">{t('authStatusLoadFailed')}</p>
        <Button variant="outline" onClick={() => void authStatus.refetch()}>
          {t('authRetryStatus')}
        </Button>
      </SecurityCardFrame>
    );
  }
  if (!auth.configured) {
    return (
      <RuntimeSecuritySetupSection
        setupUsername={setupUsername}
        setSetupUsername={setSetupUsername}
        setupPassword={setupPassword}
        setSetupPassword={setSetupPassword}
        setupConfirmPassword={setupConfirmPassword}
        setSetupConfirmPassword={setSetupConfirmPassword}
        canSubmitSetup={canSubmitSetup}
        isPending={setupAuth.isPending}
        onSubmit={handleSetup}
      />
    );
  }
  return (
    <RuntimeSecurityConfiguredSection
      authenticated={auth.authenticated}
      enabled={auth.enabled}
      username={auth.username}
      nextPassword={nextPassword}
      setNextPassword={setNextPassword}
      nextConfirmPassword={nextConfirmPassword}
      setNextConfirmPassword={setNextConfirmPassword}
      canUpdatePassword={canUpdatePassword}
      isUpdatingEnabled={updateAuthEnabled.isPending}
      isUpdatingPassword={updateAuthPassword.isPending}
      isLoggingOut={logoutAuth.isPending}
      onEnabledChange={handleEnabledChange}
      onPasswordUpdate={handlePasswordUpdate}
      onLogout={handleLogout}
    />
  );
}
