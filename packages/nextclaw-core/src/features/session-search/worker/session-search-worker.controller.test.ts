import { describe, expect, it, vi } from "vitest";
import { SessionSearchWorkerController } from "./session-search-worker.controller.js";

describe("SessionSearchWorkerController", () => {
  it("preserves the original startup failure when the worker exits during start", async () => {
    const listeners = new Map<string, (value: never) => void>();
    const terminate = vi.fn(async () => undefined);
    const worker = {
      on: vi.fn((event: "message" | "error" | "exit", listener: (value: never) => void) => {
        listeners.set(event, listener);
        return worker;
      }),
      postMessage: vi.fn(() => {
        listeners.get("exit")?.(1 as never);
      }),
      terminate
    };
    const controller = new SessionSearchWorkerController({
      databasePath: "/tmp/session-search.sqlite",
      sessionsDir: "/tmp/sessions",
      createWorker: () => worker
    });

    await expect(controller.start()).rejects.toThrow("Session search worker exited with code 1.");
    expect(terminate).toHaveBeenCalledTimes(1);
  });
});
