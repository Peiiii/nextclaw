import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ObservationStore,
  ObservationStoreError,
} from "./observation.store.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 20,
      }),
    ),
  );
});

async function createStore(): Promise<{
  path: string;
  store: ObservationStore;
}> {
  const directory = await mkdtemp(
    join(tmpdir(), "nextclaw-observation-store-"),
  );
  temporaryDirectories.push(directory);
  const path = join(directory, "observations", "state.json");
  return { path, store: new ObservationStore(path) };
}

describe("ObservationStore", () => {
  it("atomically persists and reloads the complete observation state", async () => {
    const { path, store } = await createStore();
    const state = {
      bindings: [
        {
          bindingId: "binding-1",
          extensionId: "test-extension",
          config: { path: "test" },
          target: { sessionId: "session-1", agentId: "main" },
          projection: { maxChars: 1_000 },
          status: "active" as const,
          createdAt: "2026-08-22T00:00:00.000Z",
        },
      ],
      subscriptions: [],
      deliveries: [],
    };

    await store.save(state);

    expect(await store.load()).toEqual(state);
    expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({
      version: 1,
    });
  });

  it("fails explicitly when persisted state is corrupt", async () => {
    const { path, store } = await createStore();
    await store.save({ bindings: [], subscriptions: [], deliveries: [] });
    await writeFile(path, "not-json", "utf8");

    await expect(store.load()).rejects.toBeInstanceOf(ObservationStoreError);
  });
});
