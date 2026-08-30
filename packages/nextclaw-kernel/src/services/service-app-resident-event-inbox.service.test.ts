import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ServiceAppResidentEventInboxService } from "./service-app-resident-event-inbox.service.js";

const temporaryDirectories: string[] = [];

const scope = async () => {
  const stateDirectory = await mkdtemp(path.join(tmpdir(), "nextclaw-resident-inbox-"));
  temporaryDirectories.push(stateDirectory);
  return { appId: "example.resident", instanceId: "instance-1", stateDirectory };
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(async (directory) => {
    await rm(directory, { recursive: true, force: true });
  }));
});

describe("ServiceAppResidentEventInboxService", () => {
  it("persists receive/pending, eventId dedupe, stream order, and acknowledged cursor", async () => {
    const inbox = new ServiceAppResidentEventInboxService();
    const target = await scope();
    await inbox.enqueue(target, { eventId: "a-1", streamKey: "alpha", payload: { eventId: "a-1" } });
    await inbox.enqueue(target, { eventId: "a-2", streamKey: "alpha", payload: { eventId: "a-2" } });
    const duplicate = await inbox.enqueue(target, { eventId: "a-1", streamKey: "other", payload: { eventId: "a-1" } });
    expect(duplicate.streamKey).toBe("alpha");

    const first = await inbox.leaseNext(target);
    expect(first).toMatchObject({ eventId: "a-1", sequence: 1, status: "leased" });
    await inbox.acknowledge(target, "a-1");
    const second = await inbox.leaseNext(target);
    expect(second).toMatchObject({ eventId: "a-2", sequence: 2 });

    const saved = JSON.parse(await readFile(path.join(target.stateDirectory, "service-resident-events.json"), "utf8"));
    expect(saved.cursors).toEqual({ alpha: 1 });
    expect((await stat(path.join(target.stateDirectory, "service-resident-events.json"))).mode & 0o777).toBe(0o600);
  });

  it("releases expired leases, backs off five attempts, then replays a dead letter", async () => {
    const inbox = new ServiceAppResidentEventInboxService();
    const target = await scope();
    await inbox.enqueue(target, { eventId: "retry-1", payload: { eventId: "retry-1" } });
    let event = await inbox.leaseNext(target, { leaseMs: 1 });
    expect(event?.attempt).toBe(1);
    event = await inbox.leaseNext(target, { now: new Date(Date.now() + 2) });
    expect(event?.attempt).toBe(2);
    await inbox.retry(target, "retry-1", { kind: "retry", delayMs: 0 });
    for (let attempt = 3; attempt <= 5; attempt += 1) {
      event = await inbox.leaseNext(target, { now: new Date(Date.now() + 120_000) });
      expect(event?.attempt).toBe(attempt);
      await inbox.retry(target, "retry-1", { kind: "retry", delayMs: 0 });
    }
    const dead = await inbox.list(target, { deadLettersOnly: true });
    expect(dead.entries).toMatchObject([{ eventId: "retry-1", status: "dead-letter", attempt: 5 }]);
    await inbox.replayDeadLetter(target, "retry-1");
    event = await inbox.leaseNext(target);
    expect(event).toMatchObject({ eventId: "retry-1", status: "leased", attempt: 1 });
  });

  it("freezes new leases without losing a recoverable pending event", async () => {
    const inbox = new ServiceAppResidentEventInboxService();
    const target = await scope();
    await inbox.enqueue(target, { eventId: "pause-1", payload: { eventId: "pause-1" } });
    await inbox.freeze(target);
    expect(await inbox.leaseNext(target)).toBeUndefined();
    await inbox.resume(target);
    expect(await inbox.leaseNext(target)).toMatchObject({ eventId: "pause-1", status: "leased" });
  });
});
