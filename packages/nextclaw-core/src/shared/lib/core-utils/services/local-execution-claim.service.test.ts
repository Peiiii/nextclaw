import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalExecutionClaimService } from "./local-execution-claim.service.js";

const roots: string[] = [];

function createRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "nextclaw-execution-claims-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("LocalExecutionClaimService", () => {
  it("allows only one active owner and releases for the next owner", () => {
    const root = createRoot();
    const first = new LocalExecutionClaimService(root, { pid: 101, isProcessAlive: () => true });
    const second = new LocalExecutionClaimService(root, { pid: 202, isProcessAlive: () => true });

    const acquired = first.tryAcquire("session:one");
    expect(acquired.acquired).toBe(true);
    expect(second.tryAcquire("session:one")).toMatchObject({
      acquired: false,
      reason: "active-owner",
    });

    if (!acquired.acquired) throw new Error("expected first claim owner");
    acquired.claim.release();
    expect(second.tryAcquire("session:one").acquired).toBe(true);
  });

  it("recovers a claim whose owner process is dead", () => {
    const root = createRoot();
    const first = new LocalExecutionClaimService(root, { pid: 101, isProcessAlive: () => false });
    const second = new LocalExecutionClaimService(root, { pid: 202, isProcessAlive: () => false });

    expect(first.tryAcquire("session:dead").acquired).toBe(true);
    expect(second.tryAcquire("session:dead").acquired).toBe(true);
  });

  it("retains completed claims and exposes their settlement", () => {
    const root = createRoot();
    type Completion = { status: "ok"; startedAtMs: number };
    const service = new LocalExecutionClaimService(root, { pid: 101, isProcessAlive: () => true });
    const acquired = service.tryAcquire<Completion>("cron:job:1000");
    if (!acquired.acquired) throw new Error("expected claim owner");

    acquired.claim.complete({ status: "ok", startedAtMs: 1_100 });

    expect(service.tryAcquire<Completion>("cron:job:1000")).toEqual({
      acquired: false,
      reason: "completed",
      record: expect.objectContaining({
        state: "completed",
        completion: { status: "ok", startedAtMs: 1_100 },
      }),
    });
  });

  it("does not let a stale handle release a replacement owner", () => {
    const root = createRoot();
    const first = new LocalExecutionClaimService(root, { pid: 101, isProcessAlive: () => false });
    const second = new LocalExecutionClaimService(root, {
      pid: 202,
      isProcessAlive: (pid) => pid === 202,
    });
    const stale = first.tryAcquire("session:replacement");
    const replacement = second.tryAcquire("session:replacement");
    if (!stale.acquired || !replacement.acquired) throw new Error("expected both claim handles");

    expect(() => stale.claim.release()).toThrow("no longer owned");
    expect(second.tryAcquire("session:replacement")).toMatchObject({
      acquired: false,
      reason: "active-owner",
    });
  });

  it("recovers malformed claims only after the incomplete-write grace period", () => {
    const root = createRoot();
    let now = Date.now();
    const service = new LocalExecutionClaimService(root, {
      incompleteClaimGraceMs: 100,
      isProcessAlive: () => false,
      nowMs: () => now,
      pid: 202,
    });
    const initial = service.tryAcquire("malformed");
    if (!initial.acquired) throw new Error("expected initial claim");
    const claimFiles = readdirSync(root);
    writeFileSync(join(root, claimFiles[0]!), "{");

    expect(service.tryAcquire("malformed")).toMatchObject({
      acquired: false,
      reason: "active-owner",
    });
    now += 1_000;
    expect(service.tryAcquire("malformed").acquired).toBe(true);
  });
});
