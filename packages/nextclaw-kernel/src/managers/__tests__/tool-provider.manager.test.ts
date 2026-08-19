import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NcpTool } from "@nextclaw/ncp";
import {
  DiagnosticRuntime,
  FileLogSink,
  LoggingRuntime,
  type DiagnosticRecord,
} from "@nextclaw/core";
import { ToolProviderManager } from "../tool-provider.manager.js";

function createTool(name: string): NcpTool {
  return {
    name,
    execute: async () => ({ ok: true }),
  };
}

describe("ToolProviderManager", () => {
  it("builds tools from registered providers and keeps the first provider for duplicate names", async () => {
    const manager = new ToolProviderManager();
    const firstSearch = createTool("search");
    const secondSearch = createTool("search");
    const edit = createTool("edit");

    manager.register({
      provide: () => [firstSearch, edit],
    });
    manager.register({
      provide: () => [secondSearch],
    });

    await expect(manager.buildTools({ message: { role: "user", parts: [] } })).resolves.toEqual([
      firstSearch,
      edit,
    ]);
  });

  it("unregisters providers through the disposer returned from register", async () => {
    const manager = new ToolProviderManager();
    const dispose = manager.register({
      provide: () => [createTool("read")],
    });

    dispose();

    await expect(manager.buildTools({ message: { role: "user", parts: [] } })).resolves.toEqual([]);
  });

  it("records every provided tool execution without parameters or results", async () => {
    const records: DiagnosticRecord[] = [];
    const manager = new ToolProviderManager({
      record: (event) => {
        const record = { schemaVersion: 1 as const, ...event };
        records.push(record);
        return record;
      },
    });
    manager.register({ provide: () => [createTool("search")] });
    const [tool] = await manager.buildTools({
      correlationId: "run-1",
      message: { role: "user", parts: [] },
    });

    await expect(tool?.execute({ secretQuery: "must-not-appear" }, {
      toolCallId: "call-1",
    })).resolves.toEqual({ ok: true });

    expect(records.map(({ event, outcome, correlationId, parentCorrelationId, facts }) => ({
      event,
      outcome,
      correlationId,
      parentCorrelationId,
      facts,
    }))).toEqual([
      {
        event: "tool.started",
        outcome: "started",
        correlationId: "call-1",
        parentCorrelationId: "run-1",
        facts: { toolName: "search" },
      },
      {
        event: "tool.succeeded",
        outcome: "succeeded",
        correlationId: "call-1",
        parentCorrelationId: "run-1",
        facts: { toolName: "search" },
      },
    ]);
    expect(JSON.stringify(records)).not.toContain("secretQuery");
    expect(JSON.stringify(records)).not.toContain("must-not-appear");
  });

  it("distinguishes cancellation and network failure for any provided tool", async () => {
    const records: DiagnosticRecord[] = [];
    const manager = new ToolProviderManager({
      record: (event) => {
        const record = { schemaVersion: 1 as const, ...event };
        records.push(record);
        return record;
      },
    });
    manager.register({
      provide: () => [{
        name: "remote",
        execute: async () => {
          throw Object.assign(new Error("private endpoint"), { code: "ENOTFOUND" });
        },
      }],
    });
    const [remote] = await manager.buildTools({ message: { role: "user", parts: [] } });
    await expect(remote?.execute({}, { toolCallId: "network-call" })).rejects.toThrow("private endpoint");

    manager.dispose();
    manager.register({
      provide: () => [{
        name: "cancel-me",
        execute: async () => {
          throw new DOMException("private reason", "AbortError");
        },
      }],
    });
    const [cancelled] = await manager.buildTools({ message: { role: "user", parts: [] } });
    await expect(cancelled?.execute({}, { toolCallId: "cancel-call" })).rejects.toThrow();

    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({
        domain: "tool.execution",
        event: "tool.failed",
        outcome: "failed",
        reasonCode: "network_dns_failure",
        providerCode: "enotfound",
      }),
      expect.objectContaining({
        domain: "tool.execution",
        event: "tool.cancelled",
        outcome: "cancelled",
        reasonCode: "operation_cancelled",
      }),
    ]));
    expect(JSON.stringify(records)).not.toContain("private endpoint");
    expect(JSON.stringify(records)).not.toContain("private reason");
  });

  it("fault-injects tool cancellation and network failure into queryable JSONL", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nextclaw-tool-diagnostics-"));
    try {
      const sink = new FileLogSink({
        serviceLogPath: path.join(tempDir, "logs", "service.log"),
        crashLogPath: path.join(tempDir, "logs", "crash.log"),
        archiveDirPath: path.join(tempDir, "logs", "archive"),
      });
      const logging = new LoggingRuntime({ sink, startupId: "fault-injection", pid: 123 });
      const manager = new ToolProviderManager(
        new DiagnosticRuntime((scope) => logging.getLogger(scope)),
      );
      manager.register({
        provide: () => [
          {
            name: "cancelled-tool",
            execute: async () => {
              throw new DOMException("sensitive cancellation detail", "AbortError");
            },
          },
          {
            name: "network-tool",
            execute: async () => {
              throw new TypeError("fetch https://secret.example/path?token=private failed", {
                cause: Object.assign(new Error("dns detail"), { code: "ENOTFOUND" }),
              });
            },
          },
        ],
      });
      const tools = await manager.buildTools({
        correlationId: "agent-run-fault",
        message: { role: "user", parts: [] },
      });
      await expect(tools[0]?.execute({ secret: "tool-argument" }, { toolCallId: "cancel-1" })).rejects.toThrow();
      await expect(tools[1]?.execute({ secret: "tool-argument" }, { toolCallId: "network-1" })).rejects.toThrow();

      const cancelled = logging.query({ outcome: "cancelled" });
      const network = logging.query({ reasonCode: "network_dns_failure" });
      const raw = fs.readFileSync(path.join(tempDir, "logs", "service.log"), "utf8");

      expect(cancelled.records.map((record) => record.message)).toEqual(["tool.cancelled"]);
      expect(network.records.map((record) => record.message)).toEqual(["tool.failed"]);
      expect(raw).not.toContain("tool-argument");
      expect(raw).not.toContain("secret.example");
      expect(raw).not.toContain("sensitive cancellation detail");
      expect(raw).not.toContain("token=private");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
