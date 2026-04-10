import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeartbeatService } from "./service.js";

describe("HeartbeatService", () => {
  let tempDir: string;

  beforeEach(() => {
    vi.useFakeTimers();
    tempDir = mkdtempSync(join(tmpdir(), "nextclaw-heartbeat-service-"));
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("logs heartbeat failures instead of surfacing an unhandled rejection", async () => {
    writeFileSync(join(tempDir, "HEARTBEAT.md"), "Check whether the inbox needs attention.");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onHeartbeat = vi.fn().mockRejectedValue(new Error("heartbeat boom"));
    const service = new HeartbeatService(tempDir, onHeartbeat, 1, true);

    await service.start();
    await vi.advanceTimersByTimeAsync(1_000);
    service.stop();

    expect(onHeartbeat).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("[heartbeat] background tick failed:"));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("heartbeat boom"));
  });
});
