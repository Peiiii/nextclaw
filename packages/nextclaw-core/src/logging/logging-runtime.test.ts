import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileLogSink } from "./file-log-sink.js";
import { LoggingRuntime, adaptMessageLogger } from "./logging-runtime.js";

describe("LoggingRuntime", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nextclaw-logging-runtime-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("writes app logger records through the runtime sink", () => {
    const runtime = new LoggingRuntime({
      startupId: "startup-1",
      pid: 456,
      sink: new FileLogSink({
        serviceLogPath: path.join(tempDir, "logs", "service.log"),
        crashLogPath: path.join(tempDir, "logs", "crash.log"),
        archiveDirPath: path.join(tempDir, "logs", "archive"),
      }),
      now: () => new Date("2026-04-11T17:32:33.000Z"),
    });
    const logger = runtime.getLogger("service.startup");

    logger.info("service.startup.stage", { message: "ready" });

    const serviceLog = fs.readFileSync(path.join(tempDir, "logs", "service.log"), "utf-8");
    expect(serviceLog).toContain("\"scope\":\"service.startup\"");
    expect(serviceLog).toContain("\"event\":\"service.startup.stage\"");
    expect(serviceLog).toContain("\"startupId\":\"startup-1\"");
  });

  it("creates a simple message logger adapter inside core", () => {
    const runtime = new LoggingRuntime({
      startupId: "startup-2",
      pid: 789,
      sink: new FileLogSink({
        serviceLogPath: path.join(tempDir, "logs", "service.log"),
        crashLogPath: path.join(tempDir, "logs", "crash.log"),
        archiveDirPath: path.join(tempDir, "logs", "archive"),
      }),
      now: () => new Date("2026-04-11T17:32:33.000Z"),
    });
    const messageLogger = adaptMessageLogger(runtime.getLogger("plugin.registry_loader"), "plugin.loader.message");
    messageLogger.info("plugin discovered");

    const serviceLog = fs.readFileSync(path.join(tempDir, "logs", "service.log"), "utf-8");
    expect(serviceLog).toContain("\"event\":\"plugin.loader.message\"");
  });
});
