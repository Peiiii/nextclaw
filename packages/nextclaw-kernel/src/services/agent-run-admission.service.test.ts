import { describe, expect, it } from "vitest";
import { AgentRunAdmissionService } from "./agent-run-admission.service.js";

describe("execution admission capacity", () => {
  it("queues after eight active runs, cancels a waiter, and transfers a released slot once", async () => {
    const admission = new AgentRunAdmissionService();
    const releases = await Promise.all(Array.from({ length: 8 }, () => admission.acquireExecution(new AbortController().signal)));
    const controller = new AbortController();
    const cancelled = admission.acquireExecution(controller.signal);
    let granted = false;
    const waiting = admission.acquireExecution(new AbortController().signal).then(release => { granted = true; return release; });
    await Promise.resolve(); expect(granted).toBe(false);
    controller.abort(); await expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
    releases[0]!(); releases[0]!();
    const release = await waiting; expect(granted).toBe(true);
    release(); releases.slice(1).forEach(item => item());
    (await admission.acquireExecution(new AbortController().signal))();
  });
  it("bounds the waiting queue and rejects overflow before execution", async () => {
    const admission = new AgentRunAdmissionService();
    const releases = await Promise.all(Array.from({ length: 8 }, () => admission.acquireExecution(new AbortController().signal)));
    const controllers = Array.from({ length: 16 }, () => new AbortController());
    const pending = controllers.map(controller => admission.acquireExecution(controller.signal));
    await expect(admission.acquireExecution(new AbortController().signal)).rejects.toMatchObject({ code: "SESSION_CAPACITY_EXCEEDED" });
    controllers.forEach(controller => controller.abort()); await Promise.allSettled(pending);
    releases.forEach(release => release());
  });
  it("drains ingress waiting for execution capacity before a planned restart", async () => {
    const admission = new AgentRunAdmissionService();
    const releases = await Promise.all(Array.from({ length: 8 }, () => admission.acquireExecution(new AbortController().signal)));
    const waiting = admission.accept(() => admission.acquireExecution(new AbortController().signal));
    const rejected = expect(waiting).rejects.toThrow("planned restart");
    await admission.suspend(); await rejected;
    releases.forEach(release => release()); admission.resume();
    (await admission.acquireExecution(new AbortController().signal))();
  });
});
