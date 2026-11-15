import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)("does not turn a real log-directory failure into a business failure and retries after recovery", () => {
    const logs = path.join(tempDir, "blocked-logs");
    const sink = new FileLogSink({ serviceLogPath: path.join(logs, "service.log"),
      crashLogPath: path.join(logs, "crash.log"), archiveDirPath: path.join(logs, "archive") });
    const runtime = new LoggingRuntime({ sink, startupId: "log-storage-failure", pid: 123 });
    runtime.ensureReady();
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const logger = runtime.getLogger("session.persistence");
    try {
      fs.chmodSync(logs, 0);
      expect(() => logger.error("original business failure", new Error("original cause"))).not.toThrow();
      expect(() => logger.warn("another event while log storage is blocked")).not.toThrow();
      expect(stderr).toHaveBeenCalledOnce();
      expect(String(stderr.mock.calls[0]?.[0])).toContain("EACCES");
      expect(String(stderr.mock.calls[0]?.[0])).toContain("original cause");
      fs.chmodSync(logs, 0o700);
      logger.info("logging recovered");
      expect(fs.readFileSync(path.join(logs, "service.log"), "utf8")).toContain("logging recovered");
    } finally { fs.chmodSync(logs, 0o700); stderr.mockRestore(); }
  });

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0).each(["logs", "home"])("can initialize the default logger while its %s directory is inaccessible", blockedKind => {
    const blocked = path.join(tempDir, "blocked");
    const home = blockedKind === "home" ? path.join(blocked, "home") : tempDir;
    const logs = path.join(home, "logs");
    const inaccessible = blockedKind === "home" ? blocked : logs;
    fs.mkdirSync(inaccessible);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.stubEnv("NEXTCLAW_HOME", home);
    try {
      fs.chmodSync(inaccessible, 0);
      let runtime: LoggingRuntime | undefined;
      expect(() => { runtime = new LoggingRuntime(); runtime.ensureReady(); }).not.toThrow();
      expect(() => runtime!.getLogger("startup").error("storage error", new Error("first business cause"))).not.toThrow();
      expect(stderr.mock.calls.map(call => String(call[0])).join("\n")).toContain("first business cause");
      expect(stderr.mock.calls.length).toBeLessThanOrEqual(2);
      fs.chmodSync(inaccessible, 0o700);
      runtime!.getLogger("startup").info("startup logging recovered");
      expect(fs.readFileSync(path.join(logs, "service.log"), "utf8")).toContain("startup logging recovered");
    } finally { fs.chmodSync(inaccessible, 0o700); stderr.mockRestore(); vi.unstubAllEnvs(); }
  });

  it("retains the original filesystem cause in actual persisted and queried logs", () => {
    const sink = new FileLogSink({ serviceLogPath: path.join(tempDir, "service.log"),
      crashLogPath: path.join(tempDir, "crash.log"), archiveDirPath: path.join(tempDir, "archive") });
    const runtime = new LoggingRuntime({ sink, startupId: "storage-failure", pid: 123 });
    const cause = Object.assign(new Error("fixture rename failed"), {
      code: "EPERM", errno: -4048, syscall: "rename", path: "fixture.tmp", dest: "fixture.json",
      providerConfiguration: { apiKey: "must-not-be-copied" },
    });
    runtime.getLogger("session.persistence").error("session persistence failed", {
      event: "session.persistence.failed", correlationId: "storage-trace", stage: "metadata.rename",
    }, new Error("session operation failed", { cause }));
    const record = sink.query({ correlationId: "storage-trace" }).records[0];
    expect(record?.error).toMatchObject({ cause: {
      name: "Error", message: "fixture rename failed", code: "EPERM", errno: -4048,
      syscall: "rename", path: "fixture.tmp", dest: "fixture.json",
    } });
    expect(fs.readFileSync(path.join(tempDir, "service.log"), "utf8")).not.toContain("must-not-be-copied");
    expect(JSON.parse(fs.readFileSync(path.join(tempDir, "crash.log"), "utf8").trim()).error).toEqual(record.error);
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

describe("logging error graph persistence", () => {
  it("retains primary and cleanup failures and bounds cyclic causes in nested contexts", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nextclaw-error-graph-"));
    try {
      const sink = new FileLogSink({ serviceLogPath: path.join(directory, "service.log"),
        crashLogPath: path.join(directory, "crash.log"), archiveDirPath: path.join(directory, "archive") });
      const primary = Object.assign(new Error("first write failure"), { code: "ENOSPC", configuration: "must-not-log" });
      const cleanup = Object.assign(new Error("rollback failure"), { code: "EIO" });
      const aggregate = new AggregateError([primary, cleanup], "write and rollback failed", { cause: primary });
      Object.assign(primary, { cause: aggregate });
      new LoggingRuntime({ sink }).getLogger("test").error("failed", { nested: aggregate }, aggregate);
      const record = sink.query().records[0];
      expect(record.error?.errors?.map(error => error.code)).toEqual(["ENOSPC", "EIO"]);
      expect(record.error?.cause?.cause).toEqual({ name: "CircularError", message: "[Circular cause]" });
      expect(JSON.stringify(record.context)).toContain("ENOSPC");
      expect(JSON.stringify(record)).not.toContain("must-not-log");
      let wide: Error = new Error("shared leaf");
      for (let depth = 0; depth < 4; depth++) wide = new AggregateError(Array.from({ length: 8 }, () => wide), "wide graph");
      new LoggingRuntime({ sink }).getLogger("test").error("wide failure", wide);
      const bounded = JSON.stringify(sink.query().records.at(-1));
      expect(bounded.length).toBeLessThan(120_000);
      expect(bounded).toContain("budget");
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
});
