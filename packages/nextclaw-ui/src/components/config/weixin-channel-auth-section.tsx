import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { formatDateTime, t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ExternalLink, Loader2, MessageCircleMore, QrCode } from 'lucide-react';
import { usePollChannelAuth, useStartChannelAuth } from '@/hooks/use-channel-auth';
import type { ChannelAuthPollResult, ChannelAuthStartResult } from '@/api/channel-auth.types';

type WeixinChannelAuthSectionProps = {
  channelConfig: Record<string, unknown>;
  formData: Record<string, unknown>;
  disabled?: boolean;
};

function resolveConnectedAccountIds(channelConfig: Record<string, unknown>): string[] {
  const accounts = channelConfig.accounts;
  const ids = new Set<string>();
  if (typeof channelConfig.defaultAccountId === 'string' && channelConfig.defaultAccountId.trim()) {
    ids.add(channelConfig.defaultAccountId.trim());
  }
  if (accounts && typeof accounts === 'object' && !Array.isArray(accounts)) {
    for (const accountId of Object.keys(accounts)) {
      const trimmed = accountId.trim();
      if (trimmed) {
        ids.add(trimmed);
      }
    }
  }
  return [...ids];
}

function resolveBaseUrl(formData: Record<string, unknown>, channelConfig: Record<string, unknown>): string | undefined {
  if (typeof formData.baseUrl === 'string' && formData.baseUrl.trim()) {
    return formData.baseUrl.trim();
  }
  if (typeof channelConfig.baseUrl === 'string' && channelConfig.baseUrl.trim()) {
    return channelConfig.baseUrl.trim();
  }
  return undefined;
}

export function WeixinChannelAuthSection({
  channelConfig,
  formData,
  disabled = false
}: WeixinChannelAuthSectionProps) {
  const queryClient = useQueryClient();
  const startChannelAuth = useStartChannelAuth();
  const pollChannelAuth = usePollChannelAuth();
  const [activeSession, setActiveSession] = useState<ChannelAuthStartResult | null>(null);
  const [authState, setAuthState] = useState<ChannelAuthPollResult | null>(null);

  const connectedAccountIds = useMemo(() => resolveConnectedAccountIds(channelConfig), [channelConfig]);
  const primaryAccountId = connectedAccountIds[0];
  const baseUrl = resolveBaseUrl(formData, channelConfig);
  const hasConnectedAccount = connectedAccountIds.length > 0;

  useEffect(() => {
    if (!activeSession) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const runPoll = async () => {
      try {
        const result = await pollChannelAuth.mutateAsync({
          channel: 'weixin',
          data: { sessionId: activeSession.sessionId }
        });
        if (cancelled) {
          return;
        }

        setAuthState(result);

        if (result.status === 'authorized') {
          await queryClient.invalidateQueries({ queryKey: ['config'] });
          await queryClient.invalidateQueries({ queryKey: ['config-meta'] });
          toast.success(result.message || t('weixinAuthAuthorized'));
          setActiveSession(null);
          return;
        }

        if (result.status === 'expired' || result.status === 'error') {
          toast.error(result.message || t('weixinAuthRetryRequired'));
          setActiveSession(null);
          return;
        }

        timer = setTimeout(runPoll, result.nextPollMs ?? activeSession.intervalMs);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        toast.error(`${t('error')}: ${message}`);
        setActiveSession(null);
      }
    };

    timer = setTimeout(runPoll, activeSession.intervalMs);

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [activeSession, pollChannelAuth, queryClient]);

  const handleStartAuth = async () => {
    try {
      const result = await startChannelAuth.mutateAsync({
        channel: 'weixin',
        data: {
          baseUrl,
          accountId:
            typeof formData.defaultAccountId === 'string' && formData.defaultAccountId.trim()
              ? formData.defaultAccountId.trim()
              : undefined
        }
      });
      setActiveSession(result);
      setAuthState({
        channel: 'weixin',
        status: 'pending',
        message: result.note,
        nextPollMs: result.intervalMs
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`${t('error')}: ${message}`);
    }
  };

  const statusLabel = activeSession
    ? authState?.status === 'scanned'
      ? t('weixinAuthScanned')
      : t('weixinAuthWaiting')
    : hasConnectedAccount
      ? t('weixinAuthAuthorized')
      : t('weixinAuthNotConnected');

  const connectButtonLabel = startChannelAuth.isPending
    ? t('weixinAuthStarting')
    : activeSession
      ? t('weixinAuthWaiting')
      : hasConnectedAccount
        ? t('weixinAuthReconnect')
        : t('weixinAuthConnect');

  return (
    <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary-50/70 via-white to-emerald-50/60 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-primary shadow-sm">
            <QrCode className="h-3.5 w-3.5" />
            {t('weixinAuthTitle')}
          </div>
          <div>
            <h4 className="text-base font-semibold text-gray-900">{t('weixinAuthDescription')}</h4>
            <p className="mt-1 text-sm text-gray-600">{t('weixinAuthHint')}</p>
          </div>
          <div
            className={cn(
              'inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium',
              activeSession
                ? 'bg-amber-50 text-amber-700'
                : hasConnectedAccount
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-gray-100 text-gray-600'
            )}
          >
            {activeSession ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircleMore className="h-3.5 w-3.5" />}
            {statusLabel}
          </div>
          <div className="space-y-1 text-sm text-gray-600">
            <p>{t('weixinAuthCapabilityHint')}</p>
            {primaryAccountId ? (
              <p>
                {t('weixinAuthPrimaryAccount')}: <span className="font-mono text-xs text-gray-900">{primaryAccountId}</span>
              </p>
            ) : null}
            {connectedAccountIds.length > 1 ? (
              <p>
                {t('weixinAuthConnectedAccounts')}: <span className="font-mono text-xs text-gray-900">{connectedAccountIds.join(', ')}</span>
              </p>
            ) : null}
            {baseUrl ? (
              <p>
                {t('weixinAuthBaseUrl')}: <span className="font-mono text-xs text-gray-900">{baseUrl}</span>
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            onClick={handleStartAuth}
            disabled={disabled || startChannelAuth.isPending || Boolean(activeSession)}
            className="rounded-xl"
          >
            {connectButtonLabel}
          </Button>
        </div>

        <div className="w-full max-w-sm rounded-2xl border border-dashed border-primary/25 bg-white/85 p-4 shadow-sm">
          {activeSession ? (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white p-3">
                <img src={activeSession.qrCodeUrl} alt={t('weixinAuthQrAlt')} className="mx-auto aspect-square w-full max-w-[240px] object-contain" />
              </div>
              <div className="space-y-1 text-xs text-gray-500">
                <p>{authState?.message || activeSession.note || t('weixinAuthScanPrompt')}</p>
                <p>
                  {t('weixinAuthExpiresAt')}: {formatDateTime(activeSession.expiresAt)}
                </p>
              </div>
              <a
                href={activeSession.qrCodeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary transition-colors hover:text-primary-hover"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('weixinAuthOpenQr')}
              </a>
            </div>
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl bg-gray-50/80 px-6 text-center">
              <QrCode className="h-9 w-9 text-gray-300" />
              <p className="mt-3 text-sm font-medium text-gray-700">{t('weixinAuthReadyTitle')}</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">{t('weixinAuthReadyDescription')}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
