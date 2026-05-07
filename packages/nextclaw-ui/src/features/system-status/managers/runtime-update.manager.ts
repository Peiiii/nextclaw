import type { UpdatePreferences, UpdateSnapshot } from '@nextclaw/kernel';
import { applyRuntimeUpdate, checkRuntimeUpdate, downloadRuntimeUpdate, fetchRuntimeUpdate, updateRuntimeUpdateChannel, updateRuntimeUpdatePreferences } from '@/shared/lib/api';
import type { NextClawDesktopBridge } from '@/platforms/desktop';
import { t } from '@/shared/lib/i18n';
import { toast } from 'sonner';
import { useRuntimeUpdateStore, type RuntimeUpdateBusyAction } from '@/features/system-status/stores/runtime-update.store';

type RuntimeUpdateSourceKind = 'desktop-bridge' | 'runtime-host';

interface RuntimeUpdateSourceBase {
  getState: () => Promise<UpdateSnapshot>;
  checkForUpdates: () => Promise<UpdateSnapshot>;
  downloadUpdate: () => Promise<UpdateSnapshot>;
  applyDownloadedUpdate: () => Promise<UpdateSnapshot>;
  updatePreferences: (preferences: Partial<UpdatePreferences>) => Promise<UpdateSnapshot>;
  updateChannel: (channel: UpdateSnapshot['channel']) => Promise<UpdateSnapshot>;
}

interface DesktopBridgeRuntimeUpdateSourceContract extends RuntimeUpdateSourceBase {
  kind: 'desktop-bridge';
  subscribe: (listener: (snapshot: UpdateSnapshot) => void) => () => void;
}

interface HostRuntimeUpdateSourceContract extends RuntimeUpdateSourceBase {
  kind: 'runtime-host';
}

type RuntimeUpdateSource = DesktopBridgeRuntimeUpdateSourceContract | HostRuntimeUpdateSourceContract;

class DesktopBridgeRuntimeUpdateSource implements DesktopBridgeRuntimeUpdateSourceContract {
  readonly kind = 'desktop-bridge' as const;

  constructor(private readonly desktopApi: NextClawDesktopBridge) {}

  subscribe = (listener: (snapshot: UpdateSnapshot) => void) => {
    return this.desktopApi.onUpdateStateChanged(listener);
  };

  getState = async (): Promise<UpdateSnapshot> => {
    return await this.desktopApi.getUpdateState();
  };

  checkForUpdates = async (): Promise<UpdateSnapshot> => {
    return await this.desktopApi.checkForUpdates();
  };

  downloadUpdate = async (): Promise<UpdateSnapshot> => {
    return await this.desktopApi.downloadUpdate();
  };

  applyDownloadedUpdate = async (): Promise<UpdateSnapshot> => {
    return await this.desktopApi.applyDownloadedUpdate();
  };

  updatePreferences = async (preferences: Partial<UpdatePreferences>): Promise<UpdateSnapshot> => {
    return await this.desktopApi.updatePreferences(preferences);
  };

  updateChannel = async (channel: UpdateSnapshot['channel']): Promise<UpdateSnapshot> => {
    return await this.desktopApi.updateChannel(channel);
  };
}

class HostRuntimeUpdateSource implements HostRuntimeUpdateSourceContract {
  readonly kind = 'runtime-host' as const;

  getState = async (): Promise<UpdateSnapshot> => {
    return await fetchRuntimeUpdate();
  };

  checkForUpdates = async (): Promise<UpdateSnapshot> => {
    return await checkRuntimeUpdate();
  };

  downloadUpdate = async (): Promise<UpdateSnapshot> => {
    return await downloadRuntimeUpdate();
  };

  applyDownloadedUpdate = async (): Promise<UpdateSnapshot> => {
    return await applyRuntimeUpdate();
  };

  updatePreferences = async (preferences: Partial<UpdatePreferences>): Promise<UpdateSnapshot> => {
    return await updateRuntimeUpdatePreferences(preferences);
  };

  updateChannel = async (channel: UpdateSnapshot['channel']): Promise<UpdateSnapshot> => {
    return await updateRuntimeUpdateChannel(channel);
  };
}

export class RuntimeUpdateManager {
  private unsubscribe: (() => void) | null = null;
  private subscriptionCount = 0;
  private source: RuntimeUpdateSource | null = null;

  start = async () => {
    this.subscriptionCount += 1;
    const source = this.resolveSource();
    this.source = source;
    if (!source) {
      useRuntimeUpdateStore.setState({
        supported: false,
        initialized: true,
        snapshot: null
      });
      return;
    }

    if (source.kind === 'desktop-bridge' && !this.unsubscribe) {
      this.unsubscribe = source.subscribe((snapshot) => {
        useRuntimeUpdateStore.setState({
          supported: true,
          initialized: true,
          snapshot
        });
      });
    }

    useRuntimeUpdateStore.setState({
      supported: true,
      initialized: false
    });

    try {
      const snapshot = await source.getState();
      useRuntimeUpdateStore.setState({
        supported: true,
        initialized: true,
        snapshot
      });
    } catch (error) {
      if (source.kind === 'runtime-host' && this.isUnsupportedError(error)) {
        useRuntimeUpdateStore.setState({
          supported: false,
          initialized: true,
          snapshot: null
        });
        return;
      }
      useRuntimeUpdateStore.setState({
        supported: true,
        initialized: true
      });
      toast.error(`${t('runtimeUpdatesLoadFailed')}: ${this.getErrorMessage(error)}`);
    }
  };

  stop = () => {
    this.subscriptionCount = Math.max(0, this.subscriptionCount - 1);
    if (this.subscriptionCount > 0) {
      return;
    }
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.source = null;
  };

  reportSnapshot = (snapshot: UpdateSnapshot): void => {
    if (this.source?.kind === 'desktop-bridge') {
      return;
    }
    useRuntimeUpdateStore.setState({
      supported: true,
      initialized: true,
      snapshot
    });
  };

  refreshAfterRealtimeReconnect = async (): Promise<void> => {
    if (this.source?.kind !== 'runtime-host') {
      return;
    }
    await this.refreshSnapshot();
  };

  checkForUpdates = async () => {
    let snapshot: UpdateSnapshot;
    try {
      snapshot = await this.runSnapshotCommand('checking', t('runtimeUpdatesCheckFailed'), async (source) => {
        return await source.checkForUpdates();
      });
    } catch {
      return;
    }

    if (snapshot.status === 'up-to-date') {
      toast.success(t('runtimeUpdatesAlreadyLatest'));
      return;
    }
    if (snapshot.status === 'update-available') {
      toast.success(
        t('runtimeUpdatesAvailable').replace('{version}', snapshot.availableVersion ?? t('runtimeUpdatesUnknownVersion'))
      );
      return;
    }
    if (snapshot.status === 'downloaded') {
      toast.success(t('runtimeUpdatesReadyToApply'));
    }
  };

  downloadUpdate = async () => {
    try {
      await this.runSnapshotCommand('downloading', t('runtimeUpdatesDownloadFailed'), async (source) => {
        return await source.downloadUpdate();
      });
    } catch {
      return;
    }
  };

  applyDownloadedUpdate = async () => {
    try {
      await this.runSnapshotCommand('applying', t('runtimeUpdatesApplyFailed'), async (source) => {
        return await source.applyDownloadedUpdate();
      });
    } catch {
      return;
    }
  };

  updatePreferences = async (preferences: Partial<UpdatePreferences>) => {
    try {
      await this.runSnapshotCommand('saving-preferences', t('runtimeUpdatesPreferencesFailed'), async (source) => {
        return await source.updatePreferences(preferences);
      });
    } catch {
      return;
    }
  };

  updateChannel = async (channel: UpdateSnapshot['channel']) => {
    const currentChannel = useRuntimeUpdateStore.getState().snapshot?.channel;
    if (currentChannel === channel) {
      return;
    }

    let snapshot: UpdateSnapshot;
    try {
      snapshot = await this.runSnapshotCommand('switching-channel', t('runtimeUpdatesChannelChangeFailed'), async (source) => {
        return await source.updateChannel(channel);
      });
    } catch {
      return;
    }

    if (snapshot.status === 'update-available' && snapshot.availableVersion) {
      toast.success(
        t('runtimeUpdatesChannelChangedWithUpdate')
          .replace('{channel}', this.getChannelLabel(channel))
          .replace('{version}', snapshot.availableVersion)
      );
      return;
    }

    toast.success(t('runtimeUpdatesChannelChanged').replace('{channel}', this.getChannelLabel(channel)));
  };

  private refreshSnapshot = async () => {
    if (!this.source || this.source.kind !== 'runtime-host') {
      return;
    }
    try {
      const snapshot = await this.source.getState();
      useRuntimeUpdateStore.setState({
        supported: true,
        initialized: true,
        snapshot
      });
    } catch {
      // keep the latest successful snapshot visible
    }
  };

  private runSnapshotCommand = async (
    busyAction: RuntimeUpdateBusyAction,
    fallbackMessage: string,
    job: (source: RuntimeUpdateSource) => Promise<UpdateSnapshot>
  ): Promise<UpdateSnapshot> => {
    const source = this.source ?? this.resolveSource();
    if (!source) {
      throw new Error(t('runtimeUpdatesUnavailableDescription'));
    }

    this.source = source;
    useRuntimeUpdateStore.setState({ busyAction });
    try {
      const snapshot = await job(source);
      useRuntimeUpdateStore.setState({ snapshot });
      return snapshot;
    } catch (error) {
      toast.error(`${fallbackMessage}: ${this.getErrorMessage(error)}`);
      throw error;
    } finally {
      useRuntimeUpdateStore.setState({ busyAction: null });
    }
  };

  private resolveSource = (): RuntimeUpdateSource | null => {
    const desktopApi = this.getDesktopApi();
    if (desktopApi) {
      return new DesktopBridgeRuntimeUpdateSource(desktopApi);
    }
    return new HostRuntimeUpdateSource();
  };

  private getDesktopApi = (): NextClawDesktopBridge | null => {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.nextclawDesktop ?? null;
  };

  private isUnsupportedError = (error: unknown): boolean => {
    const message = this.getErrorMessage(error).toLowerCase();
    return message.includes('404') || message.includes('not found') || message.includes('endpoint not found');
  };

  private getErrorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : t('error');
  };

  private getChannelLabel = (channel: UpdateSnapshot['channel']): string => {
    return channel === 'beta' ? t('desktopUpdatesChannelBeta') : t('desktopUpdatesChannelStable');
  };
}

export const runtimeUpdateManager = new RuntimeUpdateManager();
