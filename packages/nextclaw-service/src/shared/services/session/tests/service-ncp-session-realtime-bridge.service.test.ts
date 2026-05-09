import { describe, expect, it, vi } from "vitest";
import { createLatestOnlySessionChangePublisher } from "../service-ncp-session-realtime-bridge.service.js";

function deferredPromise<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("createLatestOnlySessionChangePublisher", () => {
  it("coalesces rapid updates for the same session into the latest rerun", async () => {
    const firstPublish = deferredPromise<void>();
    const publishedSessionKeys: string[] = [];
    const rawPublish = vi
      .fn<(sessionKey: string) => Promise<void>>()
      .mockImplementationOnce(async (sessionKey) => {
        publishedSessionKeys.push(sessionKey);
        await firstPublish.promise;
      })
      .mockImplementation(async (sessionKey) => {
        publishedSessionKeys.push(sessionKey);
      });

    const publishLatest = createLatestOnlySessionChangePublisher(rawPublish);

    const firstTask = publishLatest("session-1");
    const secondTask = publishLatest("session-1");
    const thirdTask = publishLatest("session-1");

    await Promise.resolve();
    expect(rawPublish).toHaveBeenCalledTimes(1);

    firstPublish.resolve();
    await Promise.all([firstTask, secondTask, thirdTask]);

    expect(rawPublish).toHaveBeenCalledTimes(2);
    expect(publishedSessionKeys).toEqual(["session-1", "session-1"]);
  });

  it("does not block different sessions from publishing independently", async () => {
    const publishedSessionKeys: string[] = [];
    const rawPublish = vi.fn(async (sessionKey: string) => {
      publishedSessionKeys.push(sessionKey);
    });

    const publishLatest = createLatestOnlySessionChangePublisher(rawPublish);

    await Promise.all([publishLatest("session-1"), publishLatest("session-2")]);

    expect(rawPublish).toHaveBeenCalledTimes(2);
    expect(publishedSessionKeys).toEqual(["session-1", "session-2"]);
  });
});
