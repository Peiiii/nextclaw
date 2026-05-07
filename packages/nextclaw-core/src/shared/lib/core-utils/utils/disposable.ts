export type Disposable = {
  dispose: () => void;
};

const once = (dispose: () => void): (() => void) => {
  let disposed = false;
  return () => {
    if (disposed) {
      return;
    }
    disposed = true;
    dispose();
  };
};

export const toDisposable = (dispose: () => void): Disposable => ({
  dispose: once(dispose),
});

export class DisposableStore implements Disposable {
  private readonly disposables = new Set<Disposable>();

  private isDisposed = false;

  add<T extends Disposable>(disposable: T): T {
    if (this.isDisposed) {
      disposable.dispose();
      return disposable;
    }
    this.disposables.add(disposable);
    return disposable;
  }

  clear(): void {
    const current = [...this.disposables];
    this.disposables.clear();
    for (const disposable of current.reverse()) {
      disposable.dispose();
    }
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    this.clear();
  }
}
