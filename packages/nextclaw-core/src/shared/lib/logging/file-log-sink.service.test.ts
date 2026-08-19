import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileLogSink } from "./file-log-sink.service.js";

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

  it("queries structured records across archives and reports invalid lines", () => {
    const logsDir = path.join(tempDir, "logs");
    const archiveDir = path.join(logsDir, "archive");
    fs.mkdirSync(archiveDir, { recursive: true });
    const createRecord = (
      ts: string,
      event: string,
      correlationId: string,
      outcome = "succeeded",
      reasonCode?: string,
    ) => JSON.stringify({
      ts,
      level: "info",
      scope: "diagnostics.channel.delivery",
      message: event,
      startupId: "startup-1",
      pid: 123,
      context: { event, correlationId, outcome, reasonCode },
    });
    fs.writeFileSync(
      path.join(archiveDir, "service-2026-08-19T00-00-00Z.log"),
      `${createRecord("2026-08-19T23:59:00.000Z", "inbound.observed", "trace-1")}\nlegacy line\n`,
      "utf-8",
    );
    fs.writeFileSync(
      path.join(logsDir, "service.log"),
      `${createRecord("2026-08-20T00:01:00.000Z", "inbound.accepted", "trace-1")}\n`,
      "utf-8",
    );
    const sink = new FileLogSink({
      serviceLogPath: path.join(logsDir, "service.log"),
      crashLogPath: path.join(logsDir, "crash.log"),
      archiveDirPath: archiveDir,
    });

    const result = sink.query({
      since: new Date("2026-08-19T23:00:00.000Z"),
      correlationId: "trace-1",
      limit: 10,
    });

    expect(result.records.map((record) => record.message)).toEqual([
      "inbound.observed",
      "inbound.accepted",
    ]);
    expect(result.invalidLines).toBe(1);
    expect(result.scannedFiles).toHaveLength(2);
    expect(result.truncated).toBe(false);

  });

  it("filters diagnostic terminal outcomes and reason codes", () => {
    const sink = new FileLogSink({
      serviceLogPath: path.join(tempDir, "logs", "service.log"),
      crashLogPath: path.join(tempDir, "logs", "crash.log"),
      archiveDirPath: path.join(tempDir, "logs", "archive"),
    });
    sink.writeRecord({
      ts: "2026-08-20T00:00:00.000Z",
      level: "warn",
      scope: "diagnostics.tool.execution",
      message: "tool.cancelled",
      startupId: "startup-1",
      pid: 123,
      context: { outcome: "cancelled", reasonCode: "operation_cancelled" },
    });
    sink.writeRecord({
      ts: "2026-08-20T00:00:01.000Z",
      level: "error",
      scope: "diagnostics.transport.request",
      message: "request.failed",
      startupId: "startup-1",
      pid: 123,
      context: { outcome: "failed", reasonCode: "network_timeout" },
    });

    expect(sink.query({ outcome: "cancelled" }).records.map((record) => record.message)).toEqual([
      "tool.cancelled",
    ]);
    expect(sink.query({ reasonCode: "network_timeout" }).records.map((record) => record.message)).toEqual([
      "request.failed",
    ]);
  });
});
