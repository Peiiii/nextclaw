import { controlRemoteService, fetchRemoteDoctor, updateRemoteSettings } from '@/shared/lib/api';
import type { RemoteAccessView } from '@/shared/lib/api';
import type { AccountManager, AccountPendingAction } from '@/features/account';
import { t } from '@/shared/lib/i18n';
import { toast } from 'sonner';
import { refreshRemoteStatus } from '@/features/remote/services/remote-access-query.service';
import { useRemoteAccessStore } from '@/features/remote/stores/remote-access.store';

export class RemoteAccessManager {
  private accountManager: AccountManager | null = null;

  bindAccountManager = (accountManager: AccountManager) => {
    this.accountManager = accountManager;
  };

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
    if (!currentStatus.account.loggedIn) {
      await this.accountManager?.ensureSignedIn({
        pendingAction: { type: 'enable-remote' },
        apiBase: draft.platformApiBase
      });
      return;
    }
    await this.applyEnabledState(true, currentStatus);
  };

  disableRemoteAccess = async (status: RemoteAccessView | undefined) => {
    const currentStatus = status ?? (await refreshRemoteStatus());
    await this.applyEnabledState(false, currentStatus);
  };

  repairRemoteAccess = async (status: RemoteAccessView | undefined) => {
    const currentStatus = status ?? (await refreshRemoteStatus());
    if (!currentStatus.account.loggedIn) {
      await this.accountManager?.ensureSignedIn({
        pendingAction: { type: 'enable-remote' }
      });
      return;
    }
    const action = currentStatus.service.running ? 'restart' : 'start';
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
    await this.accountManager?.startBrowserSignIn({
      status: currentStatus,
      apiBase: useRemoteAccessStore.getState().platformApiBase,
      pendingAction: { type: 'repair-remote' }
    });
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

  resumePendingActionAfterSignIn = async (action: AccountPendingAction, status: RemoteAccessView) => {
    if (!action) {
      return;
    }
    if (action.type === 'enable-remote') {
      await this.applyEnabledState(true, status);
      return;
    }
    if (action.type === 'repair-remote') {
      await this.repairRemoteAccess(status);
    }
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
    useRemoteAccessStore.getState().beginAction(params.actionLabel);
    try {
      await params.job();
      if (params.successMessage) {
        toast.success(params.successMessage);
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
