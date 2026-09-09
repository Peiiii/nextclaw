import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** This application only reminds an agent. Business claims, comments and results belong to the CLI caller. */
export class FeedbackWorker {
  constructor({ client, execute, directory, timeoutMs = 600000, checkMs = 5000 }) {
    this.client = client; this.execute = execute; this.directory = directory;
    this.timeoutMs = timeoutMs; this.checkMs = checkMs; this.busy = false;
  }
  tick = async () => {
    if (this.busy) return { state: "busy" };
    this.busy = true;
    try {
      const queue = await this.client.scan();
      if (queue.paused) return { state: "idle" };
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      for (const report of queue.approved) {
        const key = createHash("sha256").update(JSON.stringify([report.id, report.inputVersion, report.approval.reviewedAt])).digest("hex");
        const file = join(this.directory, key + ".json");
        try {
          await writeFile(file, JSON.stringify({ id: report.id, inputVersion: report.inputVersion, state: "launch-intent" }), { flag: "wx", mode: 0o600 });
        } catch (error) { if (error.code === "EEXIST") continue; throw error; }
        const result = await this.run(report);
        await writeFile(file, JSON.stringify(result), { mode: 0o600 });
        return result;
      }
      return { state: "idle" };
    } finally { this.busy = false; }
  };
  run = async (report) => {
    const controller = new AbortController();
    this.activeRun = controller;
    let checking = false;
    const deadline = setTimeout(() => controller.abort(new Error("Agent time limit exceeded.")), this.timeoutMs);
    const monitor = setInterval(async () => {
      if (checking) return;
      checking = true;
      try {
        const queue = await this.client.scan();
        const current = [...queue.approved, ...queue.unfinished].find((item) => item.id === report.id);
        if (queue.paused || !current || current.inputVersion !== report.inputVersion ||
          current.approval?.reviewedAt !== report.approval.reviewedAt) controller.abort(new Error("Approval invalidated."));
      } catch { controller.abort(new Error("Unable to verify approval.")); }
      finally { checking = false; }
    }, this.checkMs);
    try {
      await this.execute(report, controller.signal);
      if (controller.signal.aborted) throw controller.signal.reason;
      return { state: "agent-exited", id: report.id };
    } catch (error) {
      return { state: "agent-failed", id: report.id, error: String(error.message ?? error).slice(0, 500) };
    } finally { clearTimeout(deadline); clearInterval(monitor); this.activeRun = null; }
  };
  stop = () => this.activeRun?.abort(new Error("Worker stopped."));
}

export async function watchFeedback(worker, intervalMs) {
  let stopped = false;
  let wake;
  const stop = () => { stopped = true; worker.stop(); wake?.(); };
  process.once("SIGTERM", stop); process.once("SIGINT", stop);
  try {
    while (!stopped) {
      try {
        const result = await worker.tick();
        if (result.state !== "idle") console.log(JSON.stringify(result));
      } catch (error) { console.error("Feedback poll failed:", error.message); }
      if (!stopped) await new Promise((done) => {
        const timer = setTimeout(done, intervalMs);
        wake = () => { clearTimeout(timer); done(); };
      });
    }
  } finally { process.removeListener("SIGTERM", stop); process.removeListener("SIGINT", stop); }
}

export function runFeedbackCommand(argv, { cwd, input = "", signal, detached = true, environment = {} }) {
  if (!Array.isArray(argv) || !argv.length || argv.some((arg) => typeof arg !== "string")) throw new Error("Expected a trusted command argument array.");
  return new Promise((resolve, reject) => {
    // No shell interpolation, inherited feedback credentials, or unlimited output.
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/TOKEN|SECRET|PASSWORD|API_KEY|SUPPORT_/i.test(key)));
    const child = spawn(argv[0], argv.slice(1), { cwd, env: { ...env, ...environment }, detached, stdio: ["pipe", "pipe", "pipe"] });
    let output = "", size = 0, failure;
    const stop = () => { try { process.kill(detached ? -child.pid : child.pid, "SIGKILL"); } catch { /* Already exited. */ } };
    const consume = (chunk, keep) => {
      size += chunk.length;
      if (size > 1024 * 1024) { failure = new Error("Executor output limit exceeded."); stop(); }
      else if (keep) output += chunk.toString();
    };
    child.stdout.on("data", (chunk) => consume(chunk, true));
    child.stderr.on("data", (chunk) => consume(chunk, false));
    child.stdin.on("error", () => {});
    child.on("error", (error) => { failure = error; });
    child.on("close", (code) => {
      signal?.removeEventListener("abort", stop);
      if (signal?.aborted) reject(signal.reason ?? new Error("Execution cancelled."));
      else if (failure || code !== 0) reject(failure ?? new Error(`Executor exited with status ${code}.`));
      else resolve(output);
    });
    signal?.addEventListener("abort", stop, { once: true });
    child.stdin.end(input);
    if (signal?.aborted) stop();
  });
}
