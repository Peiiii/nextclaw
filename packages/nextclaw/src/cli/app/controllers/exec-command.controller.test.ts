import { PassThrough, Writable } from "node:stream";
import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import { NextclawHarnessError } from "@nextclaw/kernel";
import { executeExecCommand } from "./exec-command.controller.js";
import { registerExecCommand } from "@nextclaw-cli/cli/app/exec-command-registration.utils.js";

function io(input = "", isTTY = true) {
  const stdin = new PassThrough() as PassThrough & { isTTY?: boolean };
  stdin.isTTY = isTTY;
  if (input) {
    stdin.end(input);
  } else {
    stdin.end();
  }
  class Capture extends Writable {
    readonly chunks: Buffer[] = [];
    _write = (
      chunk: Buffer | string,
      _encoding: string,
      callback: (error?: Error | null) => void,
    ): void => {
      this.chunks.push(Buffer.from(chunk));
      callback();
    };
    text = (): string => {
      return Buffer.concat(this.chunks).toString("utf8");
    };
  }
  const stdout = new Capture();
  const stderr = new Capture();
  return { stdin, stdout, stderr };
}

describe("nextclaw exec controller", () => {
  it("combines prompt and piped stdin and emits text", async () => {
    const streams = io("additional context", false);
    const runTask = vi.fn(async (input) => ({
      schemaVersion: "nextclaw.task/v1" as const,
      status: "completed" as const,
      kind: "agent" as const,
      agentId: "main",
      sessionId: input.sessionId ?? "exec:test",
      runId: "run-1",
      text: input.input,
      completedMessage: null,
    }));

    expect(
      await executeExecCommand({ runTask }, ["hello", "world"], {}, streams),
    ).toBe(0);
    expect(runTask).toHaveBeenCalledWith(
      expect.objectContaining({ input: "hello world\nadditional context" }),
    );
    expect(streams.stdout.text()).toBe("hello world\nadditional context\n");
    expect(streams.stderr.text()).toBe("");
  });

  it("keeps json stdout machine-readable and emits jsonl events", async () => {
    const streams = io();
    const runTask = vi.fn(async (input) => {
      input.onEvent?.({ type: "run.finished", payload: {} } as never);
      return {
        schemaVersion: "nextclaw.task/v1" as const,
        status: "completed" as const,
        kind: "command" as const,
        agentId: "main",
        sessionId: "exec:test",
        runId: null,
        text: "ok",
        completedMessage: null,
      };
    });

    expect(
      await executeExecCommand(
        { runTask },
        ["ok"],
        { format: "jsonl" },
        streams,
      ),
    ).toBe(0);
    const lines = streams.stdout
      .text()
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(lines[0]).toMatchObject({
      schemaVersion: "nextclaw.exec/v1",
      type: "event",
    });
    expect(lines[1]).toMatchObject({
      schemaVersion: "nextclaw.exec/v1",
      type: "result",
    });
  });

  it("routes runtime diagnostics to stderr without contaminating machine stdout", async () => {
    const streams = io();
    const runTask = vi.fn(async () => {
      console.log("diagnostic", { phase: "run" });
      return {
        schemaVersion: "nextclaw.task/v1" as const,
        status: "completed" as const,
        kind: "agent" as const,
        agentId: "main",
        sessionId: "exec:test",
        runId: "run-1",
        text: "ok",
        completedMessage: null,
      };
    });
    expect(
      await executeExecCommand(
        { runTask },
        ["ok"],
        { format: "json" },
        streams,
      ),
    ).toBe(0);
    expect(JSON.parse(streams.stdout.text())).toMatchObject({
      result: { text: "ok" },
    });
    expect(streams.stderr.text()).toContain("diagnostic { phase: 'run' }");
  });

  it("keeps json errors machine-readable after runtime diagnostics", async () => {
    const streams = io();
    const runTask = vi.fn(async () => {
      console.warn("provider diagnostic");
      throw new NextclawHarnessError("runtime_failure", "provider failed");
    });
    expect(
      await executeExecCommand(
        { runTask },
        ["ok"],
        { format: "json" },
        streams,
      ),
    ).toBe(1);
    expect(JSON.parse(streams.stdout.text())).toMatchObject({
      schemaVersion: "nextclaw.exec/v1",
      status: "error",
      error: { code: "runtime_failure", message: "provider failed" },
    });
    expect(streams.stderr.text()).toContain("provider diagnostic");
  });

  it("keeps text stdout limited to the final reply when runtime fails after logging", async () => {
    const streams = io();
    const runTask = vi.fn(async () => {
      console.info("runtime diagnostic");
      throw new NextclawHarnessError("runtime_failure", "provider failed");
    });
    expect(await executeExecCommand({ runTask }, ["ok"], {}, streams)).toBe(1);
    expect(streams.stdout.text()).toBe("");
    expect(streams.stderr.text()).toContain("runtime diagnostic");
    expect(streams.stderr.text()).toContain("provider failed");
  });

  it("returns input errors as exit code 2", async () => {
    const streams = io();
    const runTask = vi.fn();
    expect(await executeExecCommand({ runTask }, [], {}, streams)).toBe(2);
    expect(runTask).not.toHaveBeenCalled();
    expect(streams.stderr.text()).toContain("prompt argument");
  });

  it("maps timeout cancellation to exit code 130", async () => {
    const streams = io();
    const runTask = vi.fn(
      async ({ signal }) =>
        await new Promise<never>((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new NextclawHarnessError("cancelled", "cancelled")),
            { once: true },
          );
        }),
    );
    expect(
      await executeExecCommand({ runTask }, ["slow"], { timeout: 1 }, streams),
    ).toBe(130);
    expect(streams.stderr.text()).toContain("timed out");
  });

  it("maps SIGINT cancellation to exit code 130", async () => {
    const streams = io();
    const runTask = vi.fn(
      async ({ signal }) =>
        await new Promise<never>((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new NextclawHarnessError("cancelled", "cancelled")),
            { once: true },
          );
          process.emit("SIGINT", "SIGINT");
        }),
    );
    expect(await executeExecCommand({ runTask }, ["slow"], {}, streams)).toBe(
      130,
    );
    expect(streams.stderr.text()).toContain("interrupted");
  });

  it("registers the exec command and its machine-run options", () => {
    const program = new Command();
    registerExecCommand(program, { runTask: vi.fn() } as never);
    const command = program.commands.find((entry) => entry.name() === "exec");
    expect(command).toBeDefined();
    expect(command?.options.map((option) => option.long)).toEqual(
      expect.arrayContaining([
        "--agent",
        "--session",
        "--model",
        "--format",
        "--timeout",
      ]),
    );
  });
});
