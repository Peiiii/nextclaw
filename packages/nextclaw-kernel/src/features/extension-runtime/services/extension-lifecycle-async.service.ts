import type { ExtensionProcessExitEvent } from "@kernel/features/extension-runtime/types/extension-runtime.types.js";

export type ExtensionLifecycleDeferred = {
  promise: Promise<void>;
  reject: (error: Error) => void;
  resolve: () => void;
};

export class ExtensionLifecycleAsyncService {
  private readonly callbacks = new Set<Promise<void>>();

  constructor(private readonly callback?: (
    event: ExtensionProcessExitEvent,
  ) => void | Promise<void>) {}

  createDeferred = (): ExtensionLifecycleDeferred => {
    let resolvePromise!: () => void;
    let rejectPromise!: (error: Error) => void;
    const promise = new Promise<void>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    return { promise, reject: rejectPromise, resolve: resolvePromise };
  };

  runProcessExitCallback = (event: ExtensionProcessExitEvent): void => {
    const callback = Promise.resolve(this.callback?.(event)).catch((error) => {
      console.error(
        `[extension] process-exit cleanup failed for ${event.extensionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
    this.callbacks.add(callback);
    void callback.finally(() => this.callbacks.delete(callback));
  };

  waitForCallbacks = async (): Promise<void> => {
    await Promise.all([...this.callbacks]);
  };

  waitForExitAfterKill = async (exit: Promise<void> | undefined): Promise<void> => {
    await Promise.race([
      exit ?? Promise.resolve(),
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 1000);
        timer.unref?.();
      }),
    ]);
  };
}
