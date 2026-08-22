import { randomUUID } from "node:crypto";
import { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import { NextclawAgentRegistry } from "@kernel/features/harness/managers/nextclaw-agent.manager.js";
import { NextclawContributionRegistry } from "@kernel/features/harness/managers/nextclaw-contribution.manager.js";
import { NextclawKernelFacade } from "@kernel/features/harness/managers/nextclaw-kernel-capability.manager.js";
import type { NextclawRun } from "@kernel/features/harness/managers/nextclaw-run.manager.js";
import { NextclawSessionRegistry } from "@kernel/features/harness/managers/nextclaw-session.manager.js";
import {
  NextclawHarnessError,
  type INextclawAgent,
  type INextclawAgentRegistry,
  type INextclawContributionRegistry,
  type INextclawHarness,
  type INextclawSession,
  type INextclawSessionRegistry,
  type NextclawHarnessOptions,
  type NextclawTaskInput,
  type NextclawTaskResult,
} from "@kernel/features/harness/types/nextclaw-harness.types.js";

type HarnessState = "idle" | "starting" | "started" | "disposed";

export class NextclawHarness implements INextclawHarness {
  readonly agents: INextclawAgentRegistry;
  readonly sessions: INextclawSessionRegistry;
  readonly contributions: INextclawContributionRegistry;

  private readonly contributionRegistry = new NextclawContributionRegistry();
  private readonly ownedRuns = new Set<NextclawRun>();
  private state: HarnessState = "idle";
  private kernel: NextclawKernel | undefined;
  private startPromise: Promise<void> | undefined;

  constructor(private readonly options: NextclawHarnessOptions = {}) {
    this.contributions = this.contributionRegistry;
    const sessions = new NextclawSessionRegistry(
      this.requireKernel,
      this.onRunCreated,
      this.onRunSettled,
    );
    this.sessions = sessions;
    this.agents = new NextclawAgentRegistry(
      this.requireKernel,
      sessions.forAgent,
    );
  }

  start = async (): Promise<void> => {
    if (this.state === "disposed") {
      throw new NextclawHarnessError("lifecycle", "Harness has been disposed.");
    }
    if (this.state === "started") {
      return;
    }
    if (this.startPromise) {
      return await this.startPromise;
    }
    this.state = "starting";
    this.startPromise = this.startInternal();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = undefined;
    }
  };

  runTask = async (input: NextclawTaskInput): Promise<NextclawTaskResult> => {
    if (input.signal?.aborted) {
      throw new NextclawHarnessError("cancelled", "Task was cancelled.");
    }
    const agent = this.agents.get(input.agentId);
    const session = await this.resolveTaskSession(agent, input);
    const run = await session.run({
      input: input.input,
      model: input.model,
      signal: input.signal,
      onAssistantDelta: input.onAssistantDelta,
      onEvent: input.onEvent,
    });
    return await run.result();
  };

  dispose = async (): Promise<void> => {
    if (this.state === "disposed") {
      return;
    }
    if (this.startPromise) {
      try {
        await this.startPromise;
      } catch {
        // startInternal already rolled back its Kernel.
      }
    }
    this.state = "disposed";
    const kernel = this.kernel;
    this.kernel = undefined;
    const errors: unknown[] = [];
    for (const dispose of [
      this.disposeRuns,
      this.contributionRegistry.dispose,
      async () => await kernel?.dispose(),
    ]) {
      try {
        await dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new NextclawHarnessError(
        "lifecycle",
        "Harness failed to dispose.",
        errors.length === 1
          ? errors[0]
          : new AggregateError(errors, "Multiple Harness resources failed to dispose."),
      );
    }
  };

  private readonly requireKernel = (): NextclawKernel => {
    if (this.state !== "started" || !this.kernel) {
      throw new NextclawHarnessError(
        "lifecycle",
        "Harness must be started before using this capability.",
      );
    }
    return this.kernel;
  };

  private startInternal = async (): Promise<void> => {
    let kernel: NextclawKernel | undefined;
    try {
      kernel = new NextclawKernel(this.options);
      await kernel.extensions.load({ config: kernel.configManager.config });
      await kernel.start();
      await this.contributionRegistry.start(new NextclawKernelFacade(kernel));
      this.kernel = kernel;
      this.state = "started";
    } catch (error) {
      this.kernel = undefined;
      try {
        await kernel?.dispose();
      } catch {
        // Preserve the startup failure while returning to an idle state.
      }
      this.state = "idle";
      throw new NextclawHarnessError(
        "lifecycle",
        "Harness failed to start.",
        error,
      );
    }
  };

  private resolveTaskSession = async (
    agent: INextclawAgent,
    input: NextclawTaskInput,
  ): Promise<INextclawSession> => {
    const sessionId = input.sessionId?.trim() || `exec:${randomUUID()}`;
    const existing = await this.requireKernel().sessionManager.getSession(sessionId);
    if (existing) {
      if (existing.agentId && existing.agentId !== agent.id) {
        throw new NextclawHarnessError(
          "invalid_input",
          `Session ${sessionId} belongs to agent ${existing.agentId}.`,
        );
      }
      return await agent.sessions.resume(sessionId);
    }
    return await agent.sessions.create({
      sessionId,
      task: input.input,
      model: input.model,
    });
  };

  private readonly onRunCreated = (run: NextclawRun): void => {
    this.ownedRuns.add(run);
  };

  private readonly onRunSettled = (run: NextclawRun): void => {
    this.ownedRuns.delete(run);
  };

  private disposeRuns = async (): Promise<void> => {
    const runs = [...this.ownedRuns];
    await Promise.allSettled(runs.map(async (run) => await run.cancel()));
    await Promise.allSettled(runs.map(async (run) => await run.result()));
    for (const run of runs) {
      run.dispose();
    }
    this.ownedRuns.clear();
  };
}
