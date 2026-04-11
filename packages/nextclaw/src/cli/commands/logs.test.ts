import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LogsCommands } from "./logs.js";
import { RuntimeLogManager } from "../runtime-logging/runtime-log-manager.js";

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
    const manager = new RuntimeLogManager({
      serviceLogPath: path.join(tempDir, "logs", "service.log"),
      crashLogPath: path.join(tempDir, "logs", "crash.log"),
      archiveDirPath: path.join(tempDir, "logs", "archive"),
    });
    const commands = new LogsCommands(manager);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    commands.logsPath();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Service log:"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Crash log:"));
  });

  it("tails crash.log when requested", () => {
    const manager = new RuntimeLogManager({
      serviceLogPath: path.join(tempDir, "logs", "service.log"),
      crashLogPath: path.join(tempDir, "logs", "crash.log"),
      archiveDirPath: path.join(tempDir, "logs", "archive"),
    });
    manager.appendCrashLine("fatal one", "fatal");
    manager.appendCrashLine("fatal two", "fatal");
    const commands = new LogsCommands(manager);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    commands.logsTail({ crash: true, lines: 1 });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("fatal two"));
  });
});
