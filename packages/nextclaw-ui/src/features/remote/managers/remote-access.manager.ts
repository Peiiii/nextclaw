import { controlRemoteService, fetchRemoteDoctor, updateRemoteSettings } from '@/shared/lib/api';
import type { RemoteAccessView } from '@/shared/lib/api';
import type { AccountManager } from '@/features/account';
import { t } from '@/shared/lib/i18n';
import { toast } from 'sonner';
import { refreshRemoteStatus } from '@/features/remote/services/remote-access-query.service';
import { useRemoteAccessStore } from '@/features/remote/stores/remote-access.store';

export class RemoteAccessManager {
  constructor(private readonly params: { accountManager: AccountManager }) {}

  syncStatus = (status: RemoteAccessView | undefined) => {
    if (!status) {
      return;
    }
    const store = useRemoteAccessStore.getState();
    if (store.draftTouched || store.actionLabel) {
      return;
    }
    this.hydrateDraftFromStatus(status);
  };

  setEnabled = (enabled: boolean) => {
    useRemoteAccessStore.getState().setEnabled(enabled);
  };

  setDeviceName = (deviceName: string) => {
    useRemoteAccessStore.getState().setDeviceName(deviceName);
  };

  setPlatformApiBase = (platformApiBase: string) => {
    useRemoteAccessStore.getState().setPlatformApiBase(platformApiBase);
  };

  setAdvancedOpen = (advancedOpen: boolean) => {
    useRemoteAccessStore.getState().setAdvancedOpen(advancedOpen);
  };

  enableRemoteAccess = async (status: RemoteAccessView | undefined) => {
    const currentStatus = status ?? (await refreshRemoteStatus());
    const draft = useRemoteAccessStore.getState();
    const readyStatus = await this.ensureRemoteAccount(currentStatus, draft.platformApiBase);
    await this.applyEnabledState(true, readyStatus);
  };

  disableRemoteAccess = async (status: RemoteAccessView | undefined) => {
    const currentStatus = status ?? (await refreshRemoteStatus());
    await this.applyEnabledState(false, currentStatus);
  };

  repairRemoteAccess = async (status: RemoteAccessView | undefined) => {
    const currentStatus = status ?? (await refreshRemoteStatus());
    const readyStatus = await this.ensureRemoteAccount(currentStatus);
    const action = readyStatus.service.running ? 'restart' : 'start';
    await this.runManagedAction({
      actionLabel: action === 'restart' ? t('remoteActionRestarting') : t('remoteActionStarting'),
      job: async () => {
        await controlRemoteService(action);
        const nextStatus = await refreshRemoteStatus();
        this.hydrateDraftFromStatus(nextStatus);
      },
      successMessage: t('remoteServiceRecovered')
    });
  };

  reauthorizeRemoteAccess = async (status: RemoteAccessView | undefined) => {
    const currentStatus = status ?? (await refreshRemoteStatus());
    const readyStatus = await this.params.accountManager.startBrowserSignInAndWait({
      status: currentStatus,
      apiBase: useRemoteAccessStore.getState().platformApiBase
    });
    await this.repairRemoteAccess(readyStatus);
  };

  saveAdvancedSettings = async (status: RemoteAccessView | undefined) => {
    const currentStatus = status ?? (await refreshRemoteStatus());
    const draft = useRemoteAccessStore.getState();
    await this.runManagedAction({
      actionLabel: t('remoteActionSavingAdvanced'),
      job: async () => {
        await updateRemoteSettings({
          enabled: draft.enabled,
          deviceName: draft.deviceName.trim(),
          platformApiBase: draft.platformApiBase.trim()
        });
        const nextStatus = await refreshRemoteStatus();
        this.hydrateDraftFromStatus(nextStatus);
      },
      successMessage: currentStatus.settings.enabled === draft.enabled ? t('remoteSettingsSaved') : t('remoteAdvancedSaved')
    });
  };

  runDoctor = async () => {
    await this.runManagedAction({
      actionLabel: t('remoteDoctorRunning'),
      job: async () => {
        const doctor = await fetchRemoteDoctor();
        useRemoteAccessStore.getState().setDoctor(doctor);
      },
      successMessage: t('remoteDoctorCompleted')
    });
  };

  startService = async () => {
    await this.runServiceAction('start', t('remoteActionStarting'));
  };

  restartService = async () => {
    await this.runServiceAction('restart', t('remoteActionRestarting'));
  };

  stopService = async () => {
    await this.runServiceAction('stop', t('remoteActionStopping'));
  };

  private applyEnabledState = async (enabled: boolean, status: RemoteAccessView) => {
    const draft = useRemoteAccessStore.getState();
    await this.runManagedAction({
      actionLabel: enabled ? t('remoteActionEnabling') : t('remoteActionDisabling'),
      job: async () => {
        await updateRemoteSettings({
          enabled,
          deviceName: draft.deviceName.trim(),
          platformApiBase: draft.platformApiBase.trim()
        });
        const nextStatus = await refreshRemoteStatus();
        this.hydrateDraftFromStatus(nextStatus);
        if (enabled) {
          const action = nextStatus.service.running ? 'restart' : 'start';
          await controlRemoteService(action);
        } else if (status.service.running) {
          await controlRemoteService('restart');
        }
        const finalStatus = await refreshRemoteStatus();
        this.hydrateDraftFromStatus(finalStatus);
      },
      successMessage: enabled ? t('remoteEnabledReady') : t('remoteDisabledDone')
    });
  };

  private ensureRemoteAccount = async (status: RemoteAccessView, apiBase?: string) => {
    if (status.account.loggedIn) {
      return status;
    }
    return await this.params.accountManager.ensureSignedIn({
      apiBase,
      status
    });
  };

  private runServiceAction = async (action: 'start' | 'restart' | 'stop', actionLabel: string) => {
    await this.runManagedAction({
      actionLabel,
      job: async () => {
        const result = await controlRemoteService(action);
        const nextStatus = await refreshRemoteStatus();
        this.hydrateDraftFromStatus(nextStatus);
        toast.success(result.message);
      }
    });
  };

  private hydrateDraftFromStatus = (status: RemoteAccessView) => {
    useRemoteAccessStore.getState().hydrateDraft({
      enabled: status.settings.enabled,
      deviceName: status.settings.deviceName,
      platformApiBase: status.settings.platformApiBase
    });
  };

  private runManagedAction = async (params: {
    actionLabel: string;
    job: () => Promise<void>;
    successMessage?: string;
  }) => {
    const { actionLabel, job, successMessage } = params;
    useRemoteAccessStore.getState().beginAction(actionLabel);
    try {
      await job();
      if (successMessage) {
        toast.success(successMessage);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('error');
      toast.error(message);
      throw error;
    } finally {
      useRemoteAccessStore.getState().finishAction();
    }
  };
}
