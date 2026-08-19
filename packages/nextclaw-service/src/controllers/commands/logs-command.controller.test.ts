import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileLogSink, LoggingRuntime } from "@nextclaw/core";
import { LogsCommands } from "./logs-command.controller.js";

describe("LogsCommands", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nextclaw-logs-command-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("prints the resolved log paths", () => {
    const runtime = new LoggingRuntime({
      sink: new FileLogSink({
        serviceLogPath: path.join(tempDir, "logs", "service.log"),
        crashLogPath: path.join(tempDir, "logs", "crash.log"),
        archiveDirPath: path.join(tempDir, "logs", "archive"),
      }),
    });
    const commands = new LogsCommands(runtime);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    commands.path();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Service log:"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Crash log:"));
  });

  it("tails crash.log when requested", () => {
    const runtime = new LoggingRuntime({
      sink: new FileLogSink({
        serviceLogPath: path.join(tempDir, "logs", "service.log"),
        crashLogPath: path.join(tempDir, "logs", "crash.log"),
        archiveDirPath: path.join(tempDir, "logs", "archive"),
      }),
    });
    const logger = runtime.getLogger("tests.logs");
    logger.fatal("fatal one");
    logger.fatal("fatal two");
    const commands = new LogsCommands(runtime);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    commands.tail({ crash: true, lines: 1 });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("fatal two"));
  });

  it("queries diagnostic logs by domain and correlation id", () => {
    const runtime = new LoggingRuntime({
      sink: new FileLogSink({
        serviceLogPath: path.join(tempDir, "logs", "service.log"),
        crashLogPath: path.join(tempDir, "logs", "crash.log"),
        archiveDirPath: path.join(tempDir, "logs", "archive"),
      }),
    });
    runtime.getLogger("diagnostics.channel.delivery").info("inbound.accepted", {
      event: "inbound.accepted",
      correlationId: "trace-1",
    });
    runtime.getLogger("diagnostics.agent.run").info("run.started", {
      event: "run.started",
      parentCorrelationId: "trace-1",
    });
    runtime.getLogger("diagnostics.tool.execution").warn("tool.cancelled", {
      event: "tool.cancelled",
      correlationId: "tool-1",
      parentCorrelationId: "trace-1",
      outcome: "cancelled",
      reasonCode: "operation_cancelled",
    });
    const commands = new LogsCommands(runtime);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    commands.query({ correlationId: "trace-1", json: true, limit: 10 });

    const output = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      records: Array<{ message: string }>;
      invalidLines: number;
    };
    expect(output.records.map((record) => record.message)).toEqual([
      "inbound.accepted",
      "run.started",
      "tool.cancelled",
    ]);
    expect(output.invalidLines).toBe(0);

    logSpy.mockClear();
    commands.query({ outcome: "cancelled", reasonCode: "operation_cancelled", json: true, limit: 10 });
    const cancelledOutput = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      records: Array<{ message: string }>;
    };
    expect(cancelledOutput.records.map((record) => record.message)).toEqual(["tool.cancelled"]);
  });
});
