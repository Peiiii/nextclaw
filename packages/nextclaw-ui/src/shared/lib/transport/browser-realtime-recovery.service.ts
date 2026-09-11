const RECOVERY_SIGNAL_COOLDOWN_MS = 250;

export class BrowserRealtimeRecoveryService {
  private started = false;
  private recoveryCooldownId: number | null = null;

  constructor(private readonly requestRecovery: () => void) {}

  start = (): void => {
    if (this.started) {
      return;
    }
    this.started = true;
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('pageshow', this.handlePageShow);
    window.addEventListener('focus', this.handleForegroundSignal);
  };

  stop = (): void => {
    if (!this.started) {
      return;
    }
    this.started = false;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('pageshow', this.handlePageShow);
    window.removeEventListener('focus', this.handleForegroundSignal);
    if (this.recoveryCooldownId !== null) {
      window.clearTimeout(this.recoveryCooldownId);
      this.recoveryCooldownId = null;
    }
  };

  private readonly handleVisibilityChange = (): void => {
    this.requestRecoveryIfVisible();
  };

  private readonly handleOnline = (): void => {
    this.requestRecoveryIfVisible();
  };

  private readonly handleForegroundSignal = (): void => {
    this.requestRecoveryIfVisible();
  };

  private readonly handlePageShow = (event: PageTransitionEvent): void => {
    if (event.persisted) {
      this.requestRecoveryIfVisible();
    }
  };

  private readonly requestRecoveryIfVisible = (): void => {
    if (document.visibilityState !== 'visible' || this.recoveryCooldownId !== null) {
      return;
    }
    this.requestRecovery();
    this.recoveryCooldownId = window.setTimeout(() => {
      this.recoveryCooldownId = null;
    }, RECOVERY_SIGNAL_COOLDOWN_MS);
  };
}
