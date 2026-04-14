import { fetchRuntimeControl, restartRuntimeService, startRuntimeService, stopRuntimeService } from '@/api/runtime-control';
import type {
  RuntimeControlAction,
  RuntimeControlActionResult,
  RuntimeControlView
} from '@/api/runtime-control.types';
import type { NextClawDesktopBridge } from '@/desktop/desktop-update.types';
import { t } from '@/lib/i18n';

type RecoveryWaitOptions = {
  timeoutMs?: number;
  pollIntervalMs?: number;
};

export class RuntimeControlManager {
  getControl = async (): Promise<RuntimeControlView> => {
    return this.decorateForCurrentEnvironment(await fetchRuntimeControl());
  };

  controlService = async (action: RuntimeControlAction): Promise<RuntimeControlActionResult> => {
    const desktopBridge = this.getDesktopBridge();
    if (action === 'restart-service' && desktopBridge && typeof desktopBridge.restartService === 'function') {
      const result = await desktopBridge.restartService();
      return {
        accepted: result.accepted,
        action: 'restart-service',
        lifecycle: result.lifecycle,
        message: result.message
      };
    }
    if (action === 'start-service') {
      return await startRuntimeService();
    }
    if (action === 'stop-service') {
      return await stopRuntimeService();
    }
    return await restartRuntimeService();
  };

  restartApp = async (): Promise<RuntimeControlActionResult> => {
    const desktopBridge = this.getDesktopBridge();
    if (!desktopBridge || typeof desktopBridge.restartApp !== 'function') {
      throw new Error(t('runtimeRestartAppUnavailable'));
    }
    const result = await desktopBridge.restartApp();
    return {
      accepted: result.accepted,
      action: 'restart-app',
      lifecycle: result.lifecycle,
      message: result.message
    };
  };

  waitForRecovery = async (options: RecoveryWaitOptions = {}): Promise<RuntimeControlView> => {
    const timeoutMs = options.timeoutMs ?? 25_000;
    const pollIntervalMs = options.pollIntervalMs ?? 1_500;
    const deadline = Date.now() + timeoutMs;

    let lastError: unknown = null;
    while (Date.now() < deadline) {
      try {
        return await this.getControl();
      } catch (error) {
        lastError = error;
        await this.sleep(pollIntervalMs);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(t('runtimeRecoveryTimedOut'));
  };

  decorateForCurrentEnvironment = (view: RuntimeControlView): RuntimeControlView => {
    const desktopBridge = this.getDesktopBridge();
    if (!desktopBridge || typeof desktopBridge.restartApp !== 'function') {
      return view;
    }

    return {
      ...view,
      environment: 'desktop-embedded',
      serviceState: 'running',
      canStartService: {
        available: false,
        requiresConfirmation: false,
        impact: 'none'
      },
      canStopService: {
        available: false,
        requiresConfirmation: true,
        impact: 'brief-ui-disconnect'
      },
      canRestartApp: {
        available: true,
        requiresConfirmation: true,
        impact: 'full-app-relaunch'
      },
      ownerLabel: t('runtimeControlEnvironmentDesktop'),
      managementHint: t('runtimeControlDesktopServiceHint')
    };
  };

  private getDesktopBridge = (): NextClawDesktopBridge | null => {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.nextclawDesktop ?? null;
  };

  private sleep = async (ms: number): Promise<void> => {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    });
  };
}

export const runtimeControlManager = new RuntimeControlManager();
