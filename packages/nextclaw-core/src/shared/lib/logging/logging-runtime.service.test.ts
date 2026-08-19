import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { classifyDiagnosticError } from "@nextclaw/shared";
import { FileLogSink } from "./file-log-sink.service.js";
import { DiagnosticRuntime } from "./diagnostic-runtime.service.js";
import { LoggingRuntime } from "./logging-runtime.service.js";

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

  it("writes validated diagnostic events and rejects sensitive facts", () => {
    const runtime = new LoggingRuntime({
      startupId: "startup-diagnostics",
      pid: 321,
      sink: new FileLogSink({
        serviceLogPath: path.join(tempDir, "logs", "service.log"),
        crashLogPath: path.join(tempDir, "logs", "crash.log"),
        archiveDirPath: path.join(tempDir, "logs", "archive"),
      }),
      now: () => new Date("2026-08-20T01:02:03.000Z"),
    });
    const diagnostics = new DiagnosticRuntime((scope) => runtime.getLogger(scope));

    diagnostics.record({
      domain: "channel.delivery",
      event: "inbound.accepted",
      component: "kernel.extension-runtime",
      outcome: "accepted",
      correlationId: "trace-1",
      facts: { channel: "qq", stage: "kernel" },
    });

    const serviceLog = fs.readFileSync(path.join(tempDir, "logs", "service.log"), "utf-8");
    expect(serviceLog).toContain('"scope":"diagnostics.channel.delivery"');
    expect(serviceLog).toContain('"correlationId":"trace-1"');
    expect(() => diagnostics.record({
      domain: "channel.delivery",
      event: "inbound.accepted",
      component: "kernel.extension-runtime",
      outcome: "accepted",
      facts: { content: "must not be logged" },
    })).toThrow("fact key is forbidden: content");
    expect(() => diagnostics.record({
      domain: "transport.request",
      event: "request.failed",
      component: "tests",
      outcome: "failed",
      providerCode: "Bearer private-token",
    })).toThrow("providerCode is invalid");
  });

  it("classifies cancellation, network, HTTP, and unknown errors without copying messages", () => {
    const refused = Object.assign(new Error("connect to secret.internal failed"), { code: "ECONNREFUSED" });
    const http = Object.assign(new Error("response body must stay private"), { status: 429 });

    expect(classifyDiagnosticError(new DOMException("private reason", "AbortError"))).toEqual({
      outcome: "cancelled",
      reasonCode: "operation_cancelled",
    });
    expect(classifyDiagnosticError(refused)).toEqual({
      outcome: "failed",
      reasonCode: "network_connection_refused",
      providerCode: "econnrefused",
    });
    expect(classifyDiagnosticError(http)).toEqual({
      outcome: "failed",
      reasonCode: "http_rate_limited",
      facts: { httpStatus: 429 },
    });
    expect(classifyDiagnosticError(new Error("private unknown details"))).toEqual({
      outcome: "failed",
      reasonCode: "unexpected_error",
    });
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
