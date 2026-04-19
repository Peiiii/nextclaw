import type {
  DesktopReleaseChannel,
  DesktopUpdatePreferences,
  DesktopUpdateSnapshot,
  NextClawDesktopBridge
} from '@/platforms/desktop/types/desktop-update.types';
import { useDesktopUpdateStore } from '@/platforms/desktop/stores/desktop-update.store';
import { t } from '@/lib/i18n';
import { toast } from 'sonner';

type DesktopUpdateBusyAction = 'checking' | 'downloading' | 'applying' | 'saving-preferences' | 'switching-channel';

export class DesktopUpdateManager {
  private unsubscribe: (() => void) | null = null;

  start = async () => {
    const desktopApi = this.getDesktopApi();
    if (!desktopApi) {
      useDesktopUpdateStore.setState({
        supported: false,
        initialized: true,
        snapshot: null
      });
      return;
    }

    if (!this.unsubscribe) {
      this.unsubscribe = desktopApi.onUpdateStateChanged((snapshot) => {
        useDesktopUpdateStore.setState({
          supported: true,
          initialized: true,
          snapshot
        });
      });
    }

    useDesktopUpdateStore.setState({
      supported: true,
      initialized: false
    });

    try {
      const snapshot = await desktopApi.getUpdateState();
      useDesktopUpdateStore.setState({
        supported: true,
        initialized: true,
        snapshot
      });
    } catch (error) {
      useDesktopUpdateStore.setState({
        supported: true,
        initialized: true
      });
      toast.error(`${t('desktopUpdatesLoadFailed')}: ${this.getErrorMessage(error)}`);
    }
  };

  stop = () => {
    this.unsubscribe?.();
    this.unsubscribe = null;
  };

  checkForUpdates = async () => {
    let snapshot: DesktopUpdateSnapshot;
    try {
      snapshot = await this.runSnapshotCommand('checking', t('desktopUpdatesCheckFailed'), async (desktopApi) => {
        return await desktopApi.checkForUpdates();
      });
    } catch {
      return;
    }

    if (snapshot.status === 'up-to-date') {
      toast.success(t('desktopUpdatesAlreadyLatest'));
      return;
    }
    if (snapshot.status === 'update-available') {
      toast.success(
        t('desktopUpdatesAvailable').replace('{version}', snapshot.availableVersion ?? t('desktopUpdatesUnknownVersion'))
      );
      return;
    }
    if (snapshot.status === 'downloaded') {
      toast.success(t('desktopUpdatesReadyToApply'));
      return;
    }
    if (snapshot.status === 'failed' && snapshot.errorMessage) {
      toast.error(snapshot.errorMessage);
    }
  };

  downloadUpdate = async () => {
    let snapshot: DesktopUpdateSnapshot;
    try {
      snapshot = await this.runSnapshotCommand('downloading', t('desktopUpdatesDownloadFailed'), async (desktopApi) => {
        return await desktopApi.downloadUpdate();
      });
    } catch {
      return;
    }

    if (snapshot.status === 'downloaded') {
      toast.success(t('desktopUpdatesReadyToApply'));
    }
  };

  applyDownloadedUpdate = async () => {
    try {
      await this.runSnapshotCommand('applying', t('desktopUpdatesApplyFailed'), async (desktopApi) => {
        return await desktopApi.applyDownloadedUpdate();
      });
    } catch {
      return;
    }
  };

  updatePreferences = async (preferences: Partial<DesktopUpdatePreferences>) => {
    try {
      await this.runSnapshotCommand(
        'saving-preferences',
        t('desktopUpdatesPreferencesFailed'),
        async (desktopApi) => await desktopApi.updatePreferences(preferences)
      );
    } catch {
      return;
    }
  };

  updateChannel = async (channel: DesktopReleaseChannel) => {
    const currentChannel = useDesktopUpdateStore.getState().snapshot?.channel;
    if (currentChannel === channel) {
      return;
    }

    let snapshot: DesktopUpdateSnapshot;
    try {
      snapshot = await this.runSnapshotCommand(
        'switching-channel',
        t('desktopUpdatesChannelChangeFailed'),
        async (desktopApi) => await desktopApi.updateChannel(channel)
      );
    } catch {
      return;
    }

    if (snapshot.status === 'update-available' && snapshot.availableVersion) {
      toast.success(
        t('desktopUpdatesChannelChangedWithUpdate')
          .replace('{channel}', this.getChannelLabel(channel))
          .replace('{version}', snapshot.availableVersion)
      );
      return;
    }

    toast.success(
      t('desktopUpdatesChannelChanged').replace('{channel}', this.getChannelLabel(channel))
    );
  };

  private runSnapshotCommand = async (
    busyAction: DesktopUpdateBusyAction,
    fallbackMessage: string,
    job: (desktopApi: NextClawDesktopBridge) => Promise<DesktopUpdateSnapshot>
  ): Promise<DesktopUpdateSnapshot> => {
    const desktopApi = this.getDesktopApi();
    if (!desktopApi) {
      throw new Error(t('desktopUpdatesDesktopOnlyDescription'));
    }

    useDesktopUpdateStore.setState({ busyAction });
    try {
      const snapshot = await job(desktopApi);
      useDesktopUpdateStore.setState({ snapshot });
      return snapshot;
    } catch (error) {
      toast.error(`${fallbackMessage}: ${this.getErrorMessage(error)}`);
      throw error;
    } finally {
      useDesktopUpdateStore.setState({ busyAction: null });
    }
  };

  private getDesktopApi = (): NextClawDesktopBridge | null => {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.nextclawDesktop ?? null;
  };

  private getErrorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : t('error');
  };

  private getChannelLabel = (channel: DesktopReleaseChannel): string => {
    return channel === 'beta' ? t('desktopUpdatesChannelBeta') : t('desktopUpdatesChannelStable');
  };
}

export const desktopUpdateManager = new DesktopUpdateManager();
