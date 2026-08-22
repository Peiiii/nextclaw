import type {
  Disposer,
  EffectSetup,
} from "../types/lifecycle.types.js";

type EffectRecord = {
  readonly setup: EffectSetup;
  cleanup?: Disposer;
  released: boolean;
};

type EffectScopeState = "idle" | "starting" | "started" | "disposed";

async function disposeRecords(records: readonly EffectRecord[]): Promise<void> {
  const errors: unknown[] = [];
  for (const record of [...records].reverse()) {
    if (record.released) {
      continue;
    }
    record.released = true;
    try {
      await record.cleanup?.();
    } catch (error) {
      errors.push(error);
    } finally {
      record.cleanup = undefined;
    }
  }
  if (errors.length === 1) {
    throw errors[0];
  }
  if (errors.length > 1) {
    throw new AggregateError(errors, "Multiple effects failed to dispose.");
  }
}

export class EffectScope {
  private readonly records: EffectRecord[] = [];
  private state: EffectScopeState = "idle";
  private startPromise: Promise<void> | undefined;

  register = (setup: EffectSetup): Disposer => {
    if (this.state !== "idle") {
      throw new Error("Effects can only be registered before the scope starts.");
    }
    const record: EffectRecord = { setup, released: false };
    this.records.push(record);
    return async () => {
      if (record.released) {
        return;
      }
      record.released = true;
      const cleanup = record.cleanup;
      record.cleanup = undefined;
      await cleanup?.();
    };
  };

  start = async (): Promise<void> => {
    if (this.state === "disposed") {
      throw new Error("Effect scope has been disposed.");
    }
    if (this.state === "started") {
      return;
    }
    if (this.startPromise) {
      return await this.startPromise;
    }
    this.startPromise = this.startInternal();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = undefined;
    }
  };

  dispose = async (): Promise<void> => {
    if (this.state === "disposed") {
      return;
    }
    if (this.startPromise) {
      try {
        await this.startPromise;
      } catch {
        // startInternal already rolled back every active effect.
      }
    }
    this.state = "disposed";
    const records = this.records.splice(0);
    await disposeRecords(records);
  };

  private startInternal = async (): Promise<void> => {
    this.state = "starting";
    const activated: EffectRecord[] = [];
    try {
      for (const record of this.records) {
        if (record.released) {
          continue;
        }
        const cleanup = await record.setup();
        if (record.released) {
          await cleanup?.();
          continue;
        }
        record.cleanup = cleanup || undefined;
        activated.push(record);
      }
      this.state = "started";
    } catch (error) {
      this.state = "disposed";
      this.records.splice(0);
      try {
        await disposeRecords(activated);
      } catch {
        // Preserve the setup failure; rollback remains best effort.
      }
      throw error;
    }
  };
}
