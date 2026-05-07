import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileLogSink } from "./file-log-sink.js";

describe("FileLogSink", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nextclaw-file-log-sink-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("rotates oversized service.log into archive with timestamp", () => {
    const logsDir = path.join(tempDir, "logs");
    const archiveDir = path.join(logsDir, "archive");
    fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(path.join(logsDir, "service.log"), "x".repeat(32), "utf-8");

    const sink = new FileLogSink({
      serviceLogPath: path.join(logsDir, "service.log"),
      crashLogPath: path.join(logsDir, "crash.log"),
      archiveDirPath: archiveDir,
      serviceMaxBytes: 16,
      now: () => new Date("2026-04-11T17:32:33.000Z"),
    });

    sink.ensureReady();

    expect(fs.readFileSync(path.join(logsDir, "service.log"), "utf-8")).toBe("");
    expect(fs.readdirSync(archiveDir)).toEqual(["service-2026-04-11T17-32-33Z.log"]);
  });

  it("writes error records to both service.log and crash.log", () => {
    const sink = new FileLogSink({
      serviceLogPath: path.join(tempDir, "logs", "service.log"),
      crashLogPath: path.join(tempDir, "logs", "crash.log"),
      archiveDirPath: path.join(tempDir, "logs", "archive"),
    });

    sink.writeRecord({
      ts: "2026-04-11T17:32:33.000Z",
      level: "error",
      scope: "test.scope",
      message: "test failed",
      startupId: "startup-1",
      pid: 123,
      context: { reason: "boom" },
    });

    expect(fs.readFileSync(path.join(tempDir, "logs", "service.log"), "utf-8")).toContain("\"message\":\"test failed\"");
    expect(fs.readFileSync(path.join(tempDir, "logs", "crash.log"), "utf-8")).toContain("\"message\":\"test failed\"");
  });
});
