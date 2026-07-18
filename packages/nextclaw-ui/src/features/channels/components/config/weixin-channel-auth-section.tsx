import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toDataURL } from 'qrcode';
import { Loader2, MessageCircleMore, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { NavigationLink } from '@/shared/components/actions/navigation-link';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { useConnectChannelAuth, usePollChannelAuth, useStartChannelAuth } from '@/features/channels/hooks/use-channel-auth';
import { formatDateTime, t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';
import type { ChannelAuthPollResult, ChannelAuthStartResult } from '@/shared/lib/api';

type QrChannelAuthSectionProps = {
  channelConfig: Record<string, unknown>;
  formData: Record<string, unknown>;
  channelName: 'weixin' | 'feishu';
  channelEnabled: boolean;
  disabled?: boolean;
};

type WeixinChannelAuthSectionProps = Omit<QrChannelAuthSectionProps, 'channelName'>;
type FeishuChannelAuthSectionProps = WeixinChannelAuthSectionProps;
type FeishuPlatform = 'feishu' | 'lark';

type QrChannelAuthCopy = {
  title: string;
  description: string;
  hint: string;
  capabilityHint: string;
  disabledHint: string;
  connect: string;
  qrAlt: string;
  scanPrompt: string;
  readyTitle: string;
  readyDescription: string;
  advancedTitle: string;
  advancedDescription: string;
  domainLabel?: string;
};

const QR_AUTH_COPY: Record<QrChannelAuthSectionProps['channelName'], QrChannelAuthCopy> = {
  weixin: {
    title: 'weixinAuthTitle',
    description: 'weixinAuthDescription',
    hint: 'weixinAuthHint',
    capabilityHint: 'weixinAuthCapabilityHint',
    disabledHint: 'weixinAuthDisabledHint',
    connect: 'weixinAuthConnect',
    qrAlt: 'weixinAuthQrAlt',
    scanPrompt: 'weixinAuthScanPrompt',
    readyTitle: 'weixinAuthReadyTitle',
    readyDescription: 'weixinAuthReadyDescription',
    advancedTitle: 'weixinAuthAdvancedTitle',
    advancedDescription: 'weixinAuthAdvancedDescription'
  },
  feishu: {
    title: 'feishuAuthTitle',
    description: 'feishuAuthDescription',
    hint: 'feishuAuthHint',
    capabilityHint: 'feishuAuthCapabilityHint',
    disabledHint: 'feishuAuthDisabledHint',
    connect: 'feishuAuthConnect',
    qrAlt: 'feishuAuthQrAlt',
    scanPrompt: 'feishuAuthScanPrompt',
    readyTitle: 'feishuAuthReadyTitle',
    readyDescription: 'feishuAuthReadyDescription',
    advancedTitle: 'feishuAuthAdvancedTitle',
    advancedDescription: 'feishuAuthAdvancedDescription',
    domainLabel: 'feishuAuthDomain'
  }
};

function resolveConnectedAccountIds(channelConfig: Record<string, unknown>): string[] {
  const { accounts } = channelConfig;
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

function resolveDomain(formData: Record<string, unknown>, channelConfig: Record<string, unknown>): string | undefined {
  const formDomain = typeof formData.domain === 'string' ? formData.domain.trim() : '';
  if (formDomain) {
    return formDomain;
  }
  const configDomain = typeof channelConfig.domain === 'string' ? channelConfig.domain.trim() : '';
  return configDomain || undefined;
}

function resolveFeishuPlatform(formData: Record<string, unknown>, channelConfig: Record<string, unknown>): FeishuPlatform {
  const domain = resolveDomain(formData, channelConfig);
  return domain === 'lark' ? 'lark' : 'feishu';
}

function resolveFeishuDeveloperConsoleUrl(platform: FeishuPlatform): string {
  return platform === 'lark' ? 'https://open.larksuite.com/app' : 'https://open.feishu.cn/app';
}

function useQrDataUrl(channelName: string, qrCodeUrl: string | undefined) {
  return useQuery({
    queryKey: ['channel-qr', channelName, qrCodeUrl],
    enabled: Boolean(qrCodeUrl),
    queryFn: () => toDataURL(qrCodeUrl!, { errorCorrectionLevel: 'M', margin: 1, width: 480 })
  }).data ?? null;
}

function QrAuthSummary({
  activeSession,
  baseUrl,
  channelEnabled,
  copy,
  connectButtonLabel,
  connectedAccountIds,
  disabled,
  domain,
  handleStartAuth,
  hasConnectedAccount,
  primaryAccountId,
  statusLabel
}: {
  activeSession: ChannelAuthStartResult | null;
  baseUrl?: string;
  channelEnabled: boolean;
  copy: QrChannelAuthCopy;
  connectButtonLabel: string;
  connectedAccountIds: string[];
  disabled: boolean;
  domain?: string;
  handleStartAuth: () => Promise<void>;
  hasConnectedAccount: boolean;
  primaryAccountId?: string;
  statusLabel: string;
}) {
  return (
    <div className="space-y-3">
      <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-primary shadow-sm">
        <QrCode className="h-3.5 w-3.5" />
        {t(copy.title)}
      </div>
      <div>
        <h4 className="text-base font-semibold text-gray-900">{t(copy.description)}</h4>
        <p className="mt-1 text-sm text-gray-600">{t(copy.hint)}</p>
      </div>
      <div
        className={cn(
          'inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium',
          activeSession ? 'bg-amber-50 text-amber-700' : hasConnectedAccount ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
        )}
      >
        {activeSession ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircleMore className="h-3.5 w-3.5" />}
        {statusLabel}
      </div>
      <div className="space-y-1 text-sm text-gray-600">
        <p>{channelEnabled || !hasConnectedAccount ? t(copy.capabilityHint) : t(copy.disabledHint)}</p>
        {primaryAccountId ? <p>{t('weixinAuthPrimaryAccount')}: <span className="font-mono text-xs text-gray-900">{primaryAccountId}</span></p> : null}
        {connectedAccountIds.length > 1 ? <p>{t('weixinAuthConnectedAccounts')}: <span className="font-mono text-xs text-gray-900">{connectedAccountIds.join(', ')}</span></p> : null}
        {baseUrl ? <p>{t('weixinAuthBaseUrl')}: <span className="font-mono text-xs text-gray-900">{baseUrl}</span></p> : null}
        {domain && copy.domainLabel ? <p>{t(copy.domainLabel)}: <span className="font-mono text-xs text-gray-900">{domain}</span></p> : null}
      </div>
      <Button type="button" onClick={() => void handleStartAuth()} disabled={disabled} className="rounded-xl">
        {connectButtonLabel}
      </Button>
    </div>
  );
}

function QrAuthPanel({
  activeSession,
  authMessage,
  copy,
  qrDataUrl
}: {
  activeSession: ChannelAuthStartResult | null;
  authMessage?: string;
  copy: QrChannelAuthCopy;
  qrDataUrl: string | null;
}) {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-dashed border-primary/25 bg-white/85 p-4 shadow-sm">
      {activeSession ? (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white p-3">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={t(copy.qrAlt)} className="mx-auto aspect-square w-full max-w-[240px] object-contain" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-gray-50 text-gray-500">
                <div className="flex flex-col items-center gap-2 text-center">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <p className="text-xs">{t('weixinAuthStarting')}</p>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-1 text-xs text-gray-500">
            <p>{authMessage || activeSession.note || t(copy.scanPrompt)}</p>
            <p>{t('weixinAuthExpiresAt')}: {formatDateTime(activeSession.expiresAt)}</p>
          </div>
          <NavigationLink href={activeSession.qrCodeUrl} external size="xs">
            {t('weixinAuthOpenQr')}
          </NavigationLink>
        </div>
      ) : (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl bg-gray-50/80 px-6 text-center">
          <QrCode className="h-9 w-9 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-700">{t(copy.readyTitle)}</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">{t(copy.readyDescription)}</p>
        </div>
      )}
    </div>
  );
}

export function QrChannelAuthSection({
  channelConfig,
  channelEnabled,
  channelName,
  disabled,
  formData
}: QrChannelAuthSectionProps) {
  const queryClient = useQueryClient();
  const startChannelAuth = useStartChannelAuth();
  const pollChannelAuth = usePollChannelAuth();
  const [activeSession, setActiveSession] = useState<ChannelAuthStartResult | null>(null);
  const [authState, setAuthState] = useState<ChannelAuthPollResult | null>(null);
  const [sessionStartedWhileConnected, setSessionStartedWhileConnected] = useState(false);
  const connectedAccountIds = useMemo(() => resolveConnectedAccountIds(channelConfig), [channelConfig]);
  const primaryAccountId = connectedAccountIds[0];
  const baseUrl = resolveBaseUrl(formData, channelConfig);
  const domain = channelName === 'feishu' ? resolveDomain(formData, channelConfig) : undefined;
  const hasConnectedAccount = connectedAccountIds.length > 0;
  const effectiveActiveSession = hasConnectedAccount && !sessionStartedWhileConnected ? null : activeSession;
  const qrDataUrl = useQrDataUrl(channelName, effectiveActiveSession?.qrCodeUrl);
  const copy = QR_AUTH_COPY[channelName];

  useEffect(() => {
    if (!effectiveActiveSession) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const runPoll = async () => {
      try {
        const result = await pollChannelAuth.mutateAsync({ channel: channelName, data: { sessionId: effectiveActiveSession.sessionId } });
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
        timer = setTimeout(runPoll, result.nextPollMs ?? effectiveActiveSession.intervalMs);
      } catch (error) {
        if (!cancelled) {
          toast.error(`${t('error')}: ${error instanceof Error ? error.message : String(error)}`);
          setActiveSession(null);
        }
      }
    };
    timer = setTimeout(runPoll, effectiveActiveSession.intervalMs);
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [channelName, effectiveActiveSession, pollChannelAuth, queryClient]);

  const handleStartAuth = async () => {
    try {
      const result = await startChannelAuth.mutateAsync({
        channel: channelName,
        data: {
          baseUrl,
          domain,
          accountId: typeof formData.defaultAccountId === 'string' && formData.defaultAccountId.trim() ? formData.defaultAccountId.trim() : undefined
        }
      });
      setSessionStartedWhileConnected(hasConnectedAccount);
      setActiveSession(result);
      setAuthState({ channel: channelName, status: 'pending', message: result.note, nextPollMs: result.intervalMs });
    } catch (error) {
      toast.error(`${t('error')}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const statusLabel = effectiveActiveSession
    ? authState?.status === 'scanned' ? t('weixinAuthScanned') : t('weixinAuthWaiting')
    : hasConnectedAccount
      ? channelEnabled ? t('weixinAuthAuthorized') : t('weixinAuthConnectedDisabled')
      : t('weixinAuthNotConnected');
  const connectButtonLabel = startChannelAuth.isPending
    ? t('weixinAuthStarting')
    : effectiveActiveSession
      ? t('weixinAuthWaiting')
      : hasConnectedAccount
        ? t('weixinAuthReconnect')
        : t(copy.connect);
  const authMessage = hasConnectedAccount ? t('weixinAuthAuthorized') : authState?.message;

  return (
    <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary-50/70 via-white to-emerald-50/60 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <QrAuthSummary
          activeSession={effectiveActiveSession}
          baseUrl={baseUrl}
          channelEnabled={channelEnabled}
          copy={copy}
          connectButtonLabel={connectButtonLabel}
          connectedAccountIds={connectedAccountIds}
          disabled={disabled || startChannelAuth.isPending || Boolean(effectiveActiveSession)}
          domain={domain}
          handleStartAuth={handleStartAuth}
          hasConnectedAccount={hasConnectedAccount}
          primaryAccountId={primaryAccountId}
          statusLabel={statusLabel}
        />
        <QrAuthPanel activeSession={effectiveActiveSession} authMessage={authMessage} copy={copy} qrDataUrl={qrDataUrl} />
      </div>
    </section>
  );
}

function ExistingFeishuAgentConnectPanel({
  channelConfig,
  disabled,
  formData
}: {
  channelConfig: Record<string, unknown>;
  disabled?: boolean;
  formData: Record<string, unknown>;
}) {
  const queryClient = useQueryClient();
  const connectChannelAuth = useConnectChannelAuth();
  const [platform, setPlatform] = useState<FeishuPlatform>(() => resolveFeishuPlatform(formData, channelConfig));
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const developerConsoleUrl = resolveFeishuDeveloperConsoleUrl(platform);
  const canSubmit = Boolean(appId.trim() && appSecret.trim()) && !disabled && !connectChannelAuth.isPending;

  const handleConnect = async () => {
    try {
      const result = await connectChannelAuth.mutateAsync({
        channel: 'feishu',
        data: {
          domain: platform,
          fields: {
            appId: appId.trim(),
            appSecret: appSecret.trim()
          }
        }
      });
      await queryClient.invalidateQueries({ queryKey: ['config'] });
      await queryClient.invalidateQueries({ queryKey: ['config-meta'] });
      toast.success(result.message || t('feishuExistingAgentConnectSuccess'));
      setAppSecret('');
    } catch (error) {
      toast.error(`${t('error')}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <section className="rounded-2xl border border-primary/20 bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            <MessageCircleMore className="h-3.5 w-3.5" />
            {t('feishuExistingAgentTitle')}
          </div>
          <div>
            <h4 className="text-base font-semibold text-gray-900">{t('feishuExistingAgentDescription')}</h4>
            <p className="mt-1 text-sm text-gray-600">{t('feishuExistingAgentHint')}</p>
          </div>
          <NavigationLink href={developerConsoleUrl} external>
            {platform === 'lark' ? t('feishuExistingAgentOpenLarkList') : t('feishuExistingAgentOpenFeishuList')}
          </NavigationLink>
        </div>
        <div className="w-full max-w-sm space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feishu-existing-platform">{t('feishuPlatform')}</Label>
            <Select value={platform} onValueChange={(value) => setPlatform(value === 'lark' ? 'lark' : 'feishu')}>
              <SelectTrigger id="feishu-existing-platform" className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="feishu">Feishu</SelectItem>
                <SelectItem value="lark">Lark</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="feishu-existing-app-id">App ID</Label>
            <Input id="feishu-existing-app-id" value={appId} onChange={(event) => setAppId(event.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="feishu-existing-app-secret">App Secret</Label>
            <Input id="feishu-existing-app-secret" type="password" value={appSecret} onChange={(event) => setAppSecret(event.target.value)} className="rounded-xl" />
          </div>
          <Button type="button" onClick={() => void handleConnect()} disabled={!canSubmit} className="w-full rounded-xl">
            {connectChannelAuth.isPending ? t('feishuExistingAgentConnecting') : t('feishuExistingAgentConnect')}
          </Button>
        </div>
      </div>
    </section>
  );
}

export function FeishuChannelAuthSection(props: FeishuChannelAuthSectionProps) {
  const [mode, setMode] = useState<'create' | 'existing'>('create');
  return (
    <Tabs value={mode} onValueChange={(value) => setMode(value === 'existing' ? 'existing' : 'create')}>
      <TabsList>
        <TabsTrigger value="create">{t('feishuAuthCreateNew')}</TabsTrigger>
        <TabsTrigger value="existing">{t('feishuAuthConnectExisting')}</TabsTrigger>
      </TabsList>
      <TabsContent value="create" className="mt-4">
        <QrChannelAuthSection {...props} channelName="feishu" />
      </TabsContent>
      <TabsContent value="existing" className="mt-4">
        <ExistingFeishuAgentConnectPanel {...props} />
      </TabsContent>
    </Tabs>
  );
}

export function WeixinChannelAuthSection(props: WeixinChannelAuthSectionProps) {
  return <QrChannelAuthSection {...props} channelName="weixin" />;
}
