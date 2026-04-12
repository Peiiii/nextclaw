import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileLogSink } from "./file-log-sink.js";
import { LoggingRuntime } from "./logging-runtime.js";

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

    logger.info("service startup ready", { stage: "ready" });

    const serviceLog = fs.readFileSync(path.join(tempDir, "logs", "service.log"), "utf-8");
    expect(serviceLog).toContain("\"scope\":\"service.startup\"");
    expect(serviceLog).toContain("\"message\":\"service startup ready\"");
    expect(serviceLog).toContain("\"context\":{\"stage\":\"ready\"}");
    expect(serviceLog).toContain("\"startupId\":\"startup-1\"");
  });

  it("lets app logger work as a message logger without extra adapters", () => {
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
    const pluginLogger = runtime.getLogger("plugin.registry_loader");
    pluginLogger.info("plugin discovered");

    const serviceLog = fs.readFileSync(path.join(tempDir, "logs", "service.log"), "utf-8");
    expect(serviceLog).toContain("\"scope\":\"plugin.registry_loader\"");
    expect(serviceLog).toContain("\"message\":\"plugin discovered\"");
  });

  it("captures unhandled rejections in the crash log when crash monitoring is enabled", async () => {
    const runtime = new LoggingRuntime({
      startupId: "startup-3",
      pid: 999,
      sink: new FileLogSink({
        serviceLogPath: path.join(tempDir, "logs", "service.log"),
        crashLogPath: path.join(tempDir, "logs", "crash.log"),
        archiveDirPath: path.join(tempDir, "logs", "archive"),
      }),
      now: () => new Date("2026-04-11T17:32:33.000Z"),
    });

    runtime.installProcessCrashMonitor();
    process.emit("unhandledRejection", new Error("boom rejection"), Promise.resolve());

    await new Promise((resolve) => setTimeout(resolve, 0));

    const crashLog = fs.readFileSync(path.join(tempDir, "logs", "crash.log"), "utf-8");
    expect(crashLog).toContain("\"scope\":\"runtime.crash\"");
    expect(crashLog).toContain("\"message\":\"unhandled rejection\"");
    expect(crashLog).toContain("\"error\":{\"name\":\"Error\",\"message\":\"boom rejection\"");
  });
});
