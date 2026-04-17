import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  completePasswordReset,
  completeRegister,
  login,
  sendPasswordResetCode,
  sendRegisterCode
} from '@/api/client';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createTranslator, formatDateTime, type LocaleCode } from '@/i18n/i18n.service';
import { useLocaleStore } from '@/i18n/locale.store';
import { useAuthStore } from '@/store/auth';

type AuthMode = 'login' | 'register' | 'reset_password';
type Translate = (key: string, params?: Record<string, string | number>) => string;

const highlightKeys = [
  'login.highlights.password',
  'login.highlights.register',
  'login.highlights.instance'
] as const;

type CodeFlowState = {
  mode: 'register' | 'reset_password';
  email: string;
  maskedEmail: string;
  expiresAt: string;
  debugCode: string | null;
};

type AuthCardProps = {
  locale: LocaleCode;
  t: Translate;
  mode: AuthMode;
  email: string;
  password: string;
  code: string;
  codeFlow: CodeFlowState | null;
  error: string | null;
  loginPending: boolean;
  sendCodePending: boolean;
  completePending: boolean;
  canLogin: boolean;
  canSendCode: boolean;
  canComplete: boolean;
  onModeChange: (mode: AuthMode) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onLogin: () => void;
  onSendCode: () => void;
  onComplete: () => void;
  onResetCodeFlow: () => void;
};

function LoginHighlights(props: {
  t: Translate;
}): JSX.Element {
  return (
    <section className="flex items-center">
      <div className="w-full rounded-[32px] border border-white/60 bg-white/70 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur md:p-10">
        <div className="max-w-xl space-y-6">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-brand-700">{props.t('login.platformTag')}</p>
            <h1 className="text-4xl font-semibold tracking-[-0.04em] text-slate-950 md:text-5xl">
              {props.t('login.heroTitle')}
            </h1>
            <p className="max-w-lg text-base leading-7 text-slate-600 md:text-lg">
              {props.t('login.heroDescription')}
            </p>
          </div>

          <div className="grid gap-4">
            {highlightKeys.map((prefix) => (
              <div
                key={prefix}
                className="rounded-3xl border border-slate-200/80 bg-slate-50/90 px-5 py-4"
              >
                <p className="text-sm font-semibold text-slate-950">{props.t(`${prefix}.title`)}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{props.t(`${prefix}.description`)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AuthModeTabs(props: {
  mode: AuthMode;
  t: Translate;
  onModeChange: (mode: AuthMode) => void;
}): JSX.Element {
  const modes: AuthMode[] = ['login', 'register', 'reset_password'];
  return (
    <div className="grid grid-cols-3 gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-1">
      {modes.map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => props.onModeChange(mode)}
          className={[
            'rounded-[20px] px-3 py-2 text-sm font-semibold transition',
            props.mode === mode ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600'
          ].join(' ')}
        >
          {props.t(`login.modes.${mode}.label`)}
        </button>
      ))}
    </div>
  );
}

function CodeFlowNotice(props: {
  t: Translate;
  codeFlow: CodeFlowState;
  expiresAtText: string;
}): JSX.Element {
  return (
    <div className="rounded-3xl border border-brand-100 bg-brand-50/70 px-4 py-4">
      <p className="text-sm font-medium text-slate-900">
        {props.t('login.notices.codeSent', {
          email: props.codeFlow.maskedEmail || props.codeFlow.email
        })}
      </p>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        {props.t('login.notices.codeExpiresAt', { expiresAt: props.expiresAtText || '-' })}
      </p>
      {props.codeFlow.debugCode ? (
        <p className="mt-3 rounded-2xl border border-dashed border-brand-300 bg-white px-3 py-2 text-sm text-brand-700">
          {props.t('login.notices.devCode', { code: props.codeFlow.debugCode })}
        </p>
      ) : null}
    </div>
  );
}

function AuthActionBlock(props: {
  mode: AuthMode;
  t: Translate;
  codeStepActive: boolean;
  loginPending: boolean;
  sendCodePending: boolean;
  completePending: boolean;
  canLogin: boolean;
  canSendCode: boolean;
  canComplete: boolean;
  onLogin: () => void;
  onSendCode: () => void;
  onComplete: () => void;
  onResetCodeFlow: () => void;
}): JSX.Element {
  if (props.mode === 'login') {
    return (
      <Button
        className="h-12 w-full rounded-2xl text-[15px]"
        onClick={props.onLogin}
        disabled={!props.canLogin}
      >
        {props.loginPending ? props.t('login.actions.loggingIn') : props.t('login.actions.login')}
      </Button>
    );
  }

  if (!props.codeStepActive) {
    return (
      <Button
        className="h-12 w-full rounded-2xl text-[15px]"
        onClick={props.onSendCode}
        disabled={!props.canSendCode}
      >
        {props.sendCodePending ? props.t('login.actions.sendingCode') : props.t('login.actions.sendCode')}
      </Button>
    );
  }

  return (
    <>
      <Button
        className="h-12 w-full rounded-2xl text-[15px]"
        onClick={props.onComplete}
        disabled={!props.canComplete}
      >
        {props.completePending
          ? props.mode === 'register'
            ? props.t('login.actions.registering')
            : props.t('login.actions.resettingPassword')
          : props.mode === 'register'
            ? props.t('login.actions.completeRegister')
            : props.t('login.actions.resetPassword')}
      </Button>
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          className="h-11 rounded-2xl"
          onClick={props.onSendCode}
          disabled={props.sendCodePending}
        >
          {props.sendCodePending ? props.t('login.actions.sendingCode') : props.t('login.actions.resendCode')}
        </Button>
        <Button
          variant="ghost"
          className="h-11 rounded-2xl border border-slate-200"
          onClick={props.onResetCodeFlow}
        >
          {props.t('login.actions.changeEmail')}
        </Button>
      </div>
    </>
  );
}

function LoginAuthCard(props: AuthCardProps): JSX.Element {
  const codeStepActive = props.codeFlow?.mode === props.mode;
  const currentTitle = props.t(`login.modes.${props.mode}.title`);
  const currentSubtitle = props.t(`login.modes.${props.mode}.subtitle`);
  const expiresAtText = useMemo(() => {
    if (!props.codeFlow?.expiresAt) {
      return '';
    }
    return formatDateTime(props.locale, props.codeFlow.expiresAt);
  }, [props.codeFlow, props.locale]);

  return (
    <section className="flex items-center">
      <Card className="w-full rounded-[32px] border-slate-200/80 bg-white/92 p-7 shadow-[0_24px_72px_rgba(15,23,42,0.12)] md:p-8">
        <div className="space-y-4">
          <AuthModeTabs mode={props.mode} t={props.t} onModeChange={props.onModeChange} />

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-700">{props.t('login.accountTag')}</p>
            <CardTitle className="text-[28px] leading-tight tracking-[-0.03em]">{currentTitle}</CardTitle>
            <p className="text-sm leading-6 text-slate-500">{currentSubtitle}</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="email">
              {props.t('login.fields.email')}
            </label>
            <Input
              id="email"
              type="email"
              placeholder={props.t('login.placeholders.email')}
              value={props.email}
              onChange={(event) => props.onEmailChange(event.target.value)}
              disabled={Boolean(codeStepActive)}
              className="h-12 rounded-2xl px-4 text-[15px]"
            />
          </div>

          {props.mode === 'login' ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="password">
                {props.t('login.fields.password')}
              </label>
              <Input
                id="password"
                type="password"
                placeholder={props.t('login.placeholders.password')}
                value={props.password}
                onChange={(event) => props.onPasswordChange(event.target.value)}
                className="h-12 rounded-2xl px-4 text-[15px]"
              />
            </div>
          ) : null}

          {props.mode !== 'login' && codeStepActive && props.codeFlow ? (
            <CodeFlowNotice t={props.t} codeFlow={props.codeFlow} expiresAtText={expiresAtText} />
          ) : null}

          {props.mode !== 'login' && codeStepActive ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="code">
                  {props.t('login.fields.code')}
                </label>
                <Input
                  id="code"
                  inputMode="numeric"
                  placeholder={props.t('login.placeholders.code')}
                  value={props.code}
                  onChange={(event) => props.onCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="h-12 rounded-2xl px-4 text-[18px] tracking-[0.28em]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="password-action">
                  {props.mode === 'register' ? props.t('login.fields.setPassword') : props.t('login.fields.newPassword')}
                </label>
                <Input
                  id="password-action"
                  type="password"
                  placeholder={props.t('login.placeholders.passwordMin')}
                  value={props.password}
                  onChange={(event) => props.onPasswordChange(event.target.value)}
                  className="h-12 rounded-2xl px-4 text-[15px]"
                />
              </div>
            </>
          ) : null}
        </div>

        {props.error ? <p className="mt-4 text-sm text-rose-600">{props.error}</p> : null}

        <div className="mt-6 space-y-3">
          <AuthActionBlock
            mode={props.mode}
            t={props.t}
            codeStepActive={Boolean(codeStepActive)}
            loginPending={props.loginPending}
            sendCodePending={props.sendCodePending}
            completePending={props.completePending}
            canLogin={props.canLogin}
            canSendCode={props.canSendCode}
            canComplete={props.canComplete}
            onLogin={props.onLogin}
            onSendCode={props.onSendCode}
            onComplete={props.onComplete}
            onResetCodeFlow={props.onResetCodeFlow}
          />
        </div>
      </Card>
    </section>
  );
}

function useLoginPageManager(t: Translate) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeFlow, setCodeFlow] = useState<CodeFlowState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setToken = useAuthStore((state) => state.setToken);

  const loginMutation = useMutation({
    mutationFn: async () => await login(email, password),
    onSuccess: (result) => {
      setToken(result.token);
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t('login.errors.loginFailed'));
    }
  });

  const sendRegisterCodeMutation = useMutation({
    mutationFn: async () => await sendRegisterCode(email),
    onSuccess: (result) => {
      setEmail(result.email);
      setCodeFlow({
        mode: 'register',
        email: result.email,
        maskedEmail: result.maskedEmail,
        expiresAt: result.expiresAt,
        debugCode: result.debugCode ?? null
      });
      setCode('');
      setPassword('');
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t('login.errors.sendRegisterCodeFailed'));
    }
  });

  const completeRegisterMutation = useMutation({
    mutationFn: async () => await completeRegister(codeFlow?.email ?? email, code, password),
    onSuccess: (result) => {
      setToken(result.token);
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t('login.errors.registerFailed'));
    }
  });

  const sendResetCodeMutation = useMutation({
    mutationFn: async () => await sendPasswordResetCode(email),
    onSuccess: (result) => {
      setEmail(result.email);
      setCodeFlow({
        mode: 'reset_password',
        email: result.email,
        maskedEmail: result.maskedEmail,
        expiresAt: result.expiresAt,
        debugCode: result.debugCode ?? null
      });
      setCode('');
      setPassword('');
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t('login.errors.sendResetCodeFailed'));
    }
  });

  const completeResetMutation = useMutation({
    mutationFn: async () => await completePasswordReset(codeFlow?.email ?? email, code, password),
    onSuccess: (result) => {
      setToken(result.token);
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t('login.errors.resetPasswordFailed'));
    }
  });

  useEffect(() => {
    setError(null);
    setPassword('');
    setCode('');
    if (codeFlow?.mode !== mode) {
      setCodeFlow(null);
    }
  }, [mode, codeFlow?.mode]);

  const codeStepActive = codeFlow?.mode === mode;
  const canLogin = email.trim().length > 0 && password.length > 0 && !loginMutation.isPending;
  const canSendCode = email.trim().length > 0
    && mode !== 'login'
    && !(mode === 'register' ? sendRegisterCodeMutation.isPending : sendResetCodeMutation.isPending);
  const canComplete = Boolean(codeStepActive)
    && /^\d{6}$/.test(code.trim())
    && password.trim().length >= 8
    && !(mode === 'register' ? completeRegisterMutation.isPending : completeResetMutation.isPending);

  return {
    mode,
    email,
    password,
    code,
    codeFlow,
    error,
    loginMutation,
    sendRegisterCodeMutation,
    completeRegisterMutation,
    sendResetCodeMutation,
    completeResetMutation,
    canLogin,
    canSendCode,
    canComplete,
    setMode,
    setEmail,
    setPassword,
    setCode,
    clearCodeFlow: () => {
      setCodeFlow(null);
      setCode('');
      setPassword('');
      setError(null);
    }
  };
}

export function LoginPage(): JSX.Element {
  const locale = useLocaleStore((state) => state.locale);
  const t = useMemo(() => createTranslator(locale), [locale]);
  const manager = useLoginPageManager(t);

  return (
    <main className="min-h-screen bg-transparent text-slate-950">
      <div className="mx-auto flex w-full max-w-6xl justify-end px-6 pt-6 lg:px-10">
        <LocaleSwitcher />
      </div>
      <div className="mx-auto grid min-h-[calc(100vh-72px)] w-full max-w-6xl gap-8 px-6 py-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-10">
        <LoginHighlights t={t} />
        <LoginAuthCard
          locale={locale}
          t={t}
          mode={manager.mode}
          email={manager.email}
          password={manager.password}
          code={manager.code}
          codeFlow={manager.codeFlow}
          error={manager.error}
          loginPending={manager.loginMutation.isPending}
          sendCodePending={manager.mode === 'register' ? manager.sendRegisterCodeMutation.isPending : manager.sendResetCodeMutation.isPending}
          completePending={manager.mode === 'register' ? manager.completeRegisterMutation.isPending : manager.completeResetMutation.isPending}
          canLogin={manager.canLogin}
          canSendCode={manager.canSendCode}
          canComplete={manager.canComplete}
          onModeChange={manager.setMode}
          onEmailChange={manager.setEmail}
          onPasswordChange={manager.setPassword}
          onCodeChange={manager.setCode}
          onLogin={() => manager.loginMutation.mutate()}
          onSendCode={() => {
            if (manager.mode === 'register') {
              manager.sendRegisterCodeMutation.mutate();
              return;
            }
            manager.sendResetCodeMutation.mutate();
          }}
          onComplete={() => {
            if (manager.mode === 'register') {
              manager.completeRegisterMutation.mutate();
              return;
            }
            manager.completeResetMutation.mutate();
          }}
          onResetCodeFlow={manager.clearCodeFlow}
        />
      </div>
    </main>
  );
}
