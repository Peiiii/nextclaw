import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RuntimeLogManager } from "./runtime-log-manager.js";

describe("RuntimeLogManager", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nextclaw-runtime-logs-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("rotates oversized service.log into archive with timestamp", () => {
    const logsDir = path.join(tempDir, "logs");
    const archiveDir = path.join(logsDir, "archive");
    fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(path.join(logsDir, "service.log"), "x".repeat(32), "utf-8");

    const manager = new RuntimeLogManager({
      serviceLogPath: path.join(logsDir, "service.log"),
      crashLogPath: path.join(logsDir, "crash.log"),
      archiveDirPath: archiveDir,
      serviceMaxBytes: 16,
      now: () => new Date("2026-04-11T17:32:33.000Z"),
    });

    manager.ensureReady();

    expect(fs.readFileSync(path.join(logsDir, "service.log"), "utf-8")).toBe("");
    expect(fs.readdirSync(archiveDir)).toEqual(["service-2026-04-11T17-32-33Z.log"]);
  });

  it("tails the requested log file", () => {
    const logsDir = path.join(tempDir, "logs");
    const manager = new RuntimeLogManager({
      serviceLogPath: path.join(logsDir, "service.log"),
      crashLogPath: path.join(logsDir, "crash.log"),
      archiveDirPath: path.join(logsDir, "archive"),
    });

    manager.appendServiceLine("first");
    manager.appendServiceLine("second");
    manager.appendServiceLine("third");

    const tail = manager.tail("service", 2);

    expect(tail).toHaveLength(2);
    expect(tail[0]).toContain("second");
    expect(tail[1]).toContain("third");
  });
});
