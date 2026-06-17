import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ProviderTemplateView } from '@/shared/lib/api';
import {
  useImportProviderAuthFromCli,
  usePollProviderAuth,
  useStartProviderAuth
} from '@/shared/hooks/use-config';
import { hostCapabilityManager } from '@/shared/lib/host-capabilities';
import { t } from '@/shared/lib/i18n';

type UseProviderAuthFlowParams = {
  providerName?: string;
  providerAuth?: ProviderTemplateView['auth'];
  resolvedAuthMethodId: string;
};

export function useProviderAuthFlow(params: UseProviderAuthFlowParams) {
  const { providerName, providerAuth, resolvedAuthMethodId } = params;
  const queryClient = useQueryClient();
  const startProviderAuth = useStartProviderAuth();
  const pollProviderAuth = usePollProviderAuth();
  const importProviderAuthFromCli = useImportProviderAuthFromCli();
  const [authProviderName, setAuthProviderName] = useState('');
  const [authSessionId, setAuthSessionId] = useState<string | null>(null);
  const [authStatusMessage, setAuthStatusMessage] = useState('');
  const authPollTimerRef = useRef<number | null>(null);

  const clearAuthPollTimer = useCallback(() => {
    if (authPollTimerRef.current !== null) {
      window.clearTimeout(authPollTimerRef.current);
      authPollTimerRef.current = null;
    }
  }, []);

  const scheduleProviderAuthPoll = useCallback(
    (sessionId: string, delayMs: number) => {
      clearAuthPollTimer();
      authPollTimerRef.current = window.setTimeout(() => {
        void (async () => {
          if (!providerName) {
            return;
          }
          try {
            const result = await pollProviderAuth.mutateAsync({ provider: providerName, data: { sessionId } });
            if (result.status === 'pending') {
              setAuthStatusMessage(t('providerAuthWaitingBrowser'));
              scheduleProviderAuthPoll(sessionId, result.nextPollMs ?? delayMs);
              return;
            }
            if (result.status === 'authorized') {
              setAuthSessionId(null);
              clearAuthPollTimer();
              setAuthStatusMessage(t('providerAuthCompleted'));
              toast.success(t('providerAuthCompleted'));
              queryClient.invalidateQueries({ queryKey: ['config'] });
              queryClient.invalidateQueries({ queryKey: ['providers'] });
              return;
            }
            setAuthSessionId(null);
            clearAuthPollTimer();
            setAuthStatusMessage(result.message || `Authorization ${result.status}.`);
            toast.error(result.message || `Authorization ${result.status}.`);
          } catch (error) {
            setAuthSessionId(null);
            clearAuthPollTimer();
            const message = error instanceof Error ? error.message : String(error);
            setAuthStatusMessage(message);
            toast.error(`Authorization failed: ${message}`);
          }
        })();
      }, Math.max(1000, delayMs));
    },
    [clearAuthPollTimer, pollProviderAuth, providerName, queryClient]
  );

  const startAuth = useCallback(async () => {
    if (!providerName || providerAuth?.kind !== 'device_code') {
      return;
    }

    try {
      setAuthProviderName(providerName);
      setAuthStatusMessage('');
      const result = await startProviderAuth.mutateAsync({
        provider: providerName,
        data: resolvedAuthMethodId ? { methodId: resolvedAuthMethodId } : {}
      });
      if (!result.sessionId || !result.verificationUri) {
        throw new Error(t('providerAuthStartFailed'));
      }
      setAuthSessionId(result.sessionId);
      setAuthStatusMessage(`${t('providerAuthOpenPrompt')}${result.userCode}${t('providerAuthOpenPromptSuffix')}`);
      await hostCapabilityManager.openExternalUrl(result.verificationUri);
      scheduleProviderAuthPoll(result.sessionId, result.intervalMs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAuthSessionId(null);
      clearAuthPollTimer();
      setAuthStatusMessage(message);
      toast.error(`${t('providerAuthStartFailed')}: ${message}`);
    }
  }, [clearAuthPollTimer, providerAuth?.kind, providerName, resolvedAuthMethodId, scheduleProviderAuthPoll, startProviderAuth]);

  const importAuthFromCli = useCallback(async () => {
    if (!providerName || providerAuth?.kind !== 'device_code') {
      return;
    }
    try {
      setAuthProviderName(providerName);
      clearAuthPollTimer();
      setAuthSessionId(null);
      const result = await importProviderAuthFromCli.mutateAsync({ provider: providerName });
      setAuthStatusMessage(`${t('providerAuthImportStatusPrefix')}${result.expiresAt ? ` (expires: ${result.expiresAt})` : ''}`);
      toast.success(t('providerAuthImportSuccess'));
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['providers'] });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAuthStatusMessage(message);
      toast.error(`${t('providerAuthImportFailed')}: ${message}`);
    }
  }, [clearAuthPollTimer, importProviderAuthFromCli, providerAuth?.kind, providerName, queryClient]);

  useEffect(() => {
    clearAuthPollTimer();
  }, [clearAuthPollTimer, providerName]);

  useEffect(() => () => clearAuthPollTimer(), [clearAuthPollTimer]);

  return {
    authSessionId: authProviderName === providerName ? authSessionId : null,
    authStatusMessage: authProviderName === providerName ? authStatusMessage : '',
    importAuthFromCli,
    importPending: importProviderAuthFromCli.isPending,
    startAuth,
    startPending: startProviderAuth.isPending
  };
}
