import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ObservationState } from "@kernel/features/observation/types/observation.types.js";

const OBSERVATION_STORE_VERSION = 1;

type ObservationStoreFile = ObservationState & {
  version: typeof OBSERVATION_STORE_VERSION;
};

export class ObservationStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ObservationStoreError";
  }
}

export class ObservationStore {
  private state: Promise<ObservationState> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly storePath: string) {}

  read = async (): Promise<ObservationState> => {
    await this.writeQueue;
    return structuredClone(await this.loadCached());
  };

  mutate = <T>(
    operation: (state: ObservationState) => T | Promise<T>,
  ): Promise<T> => {
    const run = this.writeQueue.then(async () => {
      const current = await this.loadCached();
      const next = structuredClone(current);
      const result = await operation(next);
      await this.save(next);
      this.state = Promise.resolve(next);
      return result;
    });
    this.writeQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  flush = async (): Promise<void> => await this.writeQueue;

  load = async (): Promise<ObservationState> => {
    try {
      const value = JSON.parse(
        await readFile(this.storePath, "utf8"),
      ) as unknown;
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        (value as Partial<ObservationStoreFile>).version !==
          OBSERVATION_STORE_VERSION ||
        !Array.isArray((value as Partial<ObservationStoreFile>).bindings) ||
        !Array.isArray(
          (value as Partial<ObservationStoreFile>).subscriptions,
        ) ||
        !Array.isArray((value as Partial<ObservationStoreFile>).deliveries)
      ) {
        throw new ObservationStoreError(
          "observation store has an unsupported structure",
        );
      }
      const parsed = value as ObservationStoreFile;
      return structuredClone({
        bindings: parsed.bindings,
        subscriptions: parsed.subscriptions,
        deliveries: parsed.deliveries,
      });
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return { bindings: [], subscriptions: [], deliveries: [] };
      }
      if (error instanceof SyntaxError) {
        throw new ObservationStoreError(
          "observation store contains invalid JSON",
        );
      }
      throw error;
    }
  };

  save = async (state: ObservationState): Promise<void> => {
    const tempPath = `${this.storePath}.${randomUUID()}.tmp`;
    const value: ObservationStoreFile = {
      version: OBSERVATION_STORE_VERSION,
      bindings: structuredClone(state.bindings),
      subscriptions: structuredClone(state.subscriptions),
      deliveries: structuredClone(state.deliveries),
    };
    await mkdir(dirname(this.storePath), { recursive: true });
    try {
      await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
      await rename(tempPath, this.storePath);
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
  };

  private loadCached = (): Promise<ObservationState> => {
    this.state ??= this.load();
    return this.state;
  };

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT";
}
