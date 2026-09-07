export class BrowserRealtimeRecoveryService {
  private started = false;

  constructor(private readonly requestRecovery: () => void) {}

  start = (): void => {
    if (this.started) {
      return;
    }
    this.started = true;
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('online', this.handleOnline);
  };

  stop = (): void => {
    if (!this.started) {
      return;
    }
    this.started = false;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('online', this.handleOnline);
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.requestRecovery();
    }
  };

  private readonly handleOnline = (): void => {
    if (document.visibilityState === 'visible') {
      this.requestRecovery();
    }
  };
}
