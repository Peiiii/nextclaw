import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileLogSink, LoggingRuntime } from "@nextclaw/core";
import { LogsCommands } from "./index.js";

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

    commands.logsPath();

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

    commands.logsTail({ crash: true, lines: 1 });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("fatal two"));
  });
});
