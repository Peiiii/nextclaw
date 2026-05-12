export type Cleanup = () => void;

export type Disposable = {
  dispose: () => void;
};

const once = (cleanup: Cleanup): Cleanup => {
  let disposed = false;
  return () => {
    if (disposed) {
      return;
    }
    disposed = true;
    cleanup();
  };
};

const runCleanups = (cleanups: Cleanup[]): void => {
  const errors: unknown[] = [];
  for (const cleanup of cleanups) {
    try {
      cleanup();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length === 1) {
    throw errors[0];
  }
  if (errors.length > 1) {
    throw new AggregateError(errors, "Failed to run cleanups.");
  }
};

export const toDisposable = (dispose: Cleanup): Disposable => ({
  dispose: once(dispose),
});

export abstract class DisposableOwner implements Disposable {
  protected readonly cleanups: Cleanup[] = [];
  private disposed = false;

  protected get isDisposed(): boolean {
    return this.disposed;
  }

  protected addCleanup = (cleanup: Cleanup): Cleanup => {
    const disposableCleanup = once(cleanup);
    if (this.disposed) {
      disposableCleanup();
      return disposableCleanup;
    }
    this.cleanups.push(disposableCleanup);
    return disposableCleanup;
  };

  protected addDisposable = <T extends Disposable>(disposable: T): T => {
    this.addCleanup(() => {
      disposable.dispose();
    });
    return disposable;
  };

  dispose = (): void => {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    const current = this.cleanups.splice(0);
    runCleanups(current.reverse());
  };
}

export class DisposableStore implements Disposable {
  private readonly disposables = new Set<Disposable>();

  private isDisposed = false;

  add = <T extends Disposable>(disposable: T): T => {
    if (this.isDisposed) {
      disposable.dispose();
      return disposable;
    }
    this.disposables.add(disposable);
    return disposable;
  };

  clear = (): void => {
    const current = [...this.disposables];
    this.disposables.clear();
    for (const disposable of current.reverse()) {
      disposable.dispose();
    }
  };

  dispose = (): void => {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    this.clear();
  };
}
