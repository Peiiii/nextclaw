import type {
  DesktopPresencePreferences,
  NextClawDesktopBridge
} from '@/platforms/desktop/types/desktop-update.types';
import { useDesktopPresenceStore } from '@/platforms/desktop/stores/desktop-presence.store';
import { t } from '@/shared/lib/i18n';
import { toast } from 'sonner';

export class DesktopPresenceManager {
  start = async () => {
    const desktopApi = this.getDesktopApi();
    if (!desktopApi) {
      this.markUnsupported();
      return;
    }

    useDesktopPresenceStore.setState({
      supported: true,
      initialized: false,
      busyAction: 'loading'
    });

    try {
      const snapshot = await desktopApi.getPresenceState();
      useDesktopPresenceStore.setState({
        supported: true,
        initialized: true,
        busyAction: null,
        snapshot
      });
    } catch (error) {
      useDesktopPresenceStore.setState({
        supported: true,
        initialized: true,
        busyAction: null
      });
      toast.error(`${t('runtimePresenceLoadFailed')}: ${this.getErrorMessage(error)}`);
    }
  };

  markUnsupported = () => {
    useDesktopPresenceStore.setState({
      supported: false,
      initialized: true,
      busyAction: null,
      snapshot: null
    });
  };

  updatePreferences = async (preferences: Partial<DesktopPresencePreferences>) => {
    const desktopApi = this.getDesktopApi();
    if (!desktopApi) {
      throw new Error(t('runtimePresenceLaunchAtLoginUnavailable'));
    }

    useDesktopPresenceStore.setState({
      busyAction: 'saving-preferences'
    });

    try {
      const snapshot = await desktopApi.updatePresencePreferences(preferences);
      useDesktopPresenceStore.setState({
        supported: true,
        initialized: true,
        snapshot
      });
      toast.success(t('runtimePresenceSaved'));
      return snapshot;
    } catch (error) {
      toast.error(`${t('runtimePresenceSaveFailed')}: ${this.getErrorMessage(error)}`);
      throw error;
    } finally {
      useDesktopPresenceStore.setState({
        busyAction: null
      });
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
}

export const desktopPresenceManager = new DesktopPresenceManager();
