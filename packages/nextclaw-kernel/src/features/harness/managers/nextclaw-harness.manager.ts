import { NextclawAgentRegistry } from "@kernel/features/harness/managers/nextclaw-agent.manager.js";
import { NextclawContributionRegistry } from "@kernel/features/harness/managers/nextclaw-contribution.manager.js";
import type { NextclawRun } from "@kernel/features/harness/managers/nextclaw-run.manager.js";
import { NextclawSessionRegistry } from "@kernel/features/harness/managers/nextclaw-session.manager.js";
import { AgentRunClient } from "@kernel/services/agent-run-client.service.js";
import { AgentKernel } from "@kernel/managers/agent-kernel.manager.js";
import type { AgentKernelModule } from "@kernel/types/agent-platform.types.js";
import {
  NextclawHarnessError,
  type INextclawAgent,
  type INextclawAgentRegistry,
  type INextclawContributionRegistry,
  type INextclawHarness,
  type INextclawSession,
  type INextclawSessionRegistry,
  type NextclawHarnessOptions,
  type NextclawHarnessResources,
  type NextclawTaskInput,
  type NextclawTaskResult,
  type NextclawUserQuestion,
  type NextclawUserQuestionReply,
} from "@kernel/features/harness/types/nextclaw-harness.types.js";

type HarnessState = "idle" | "starting" | "started" | "disposed";

export class NextclawHarness implements INextclawHarness {
  readonly agents: INextclawAgentRegistry;
  readonly sessions: INextclawSessionRegistry;
  readonly contributions: INextclawContributionRegistry;

  private readonly contributionRegistry = new NextclawContributionRegistry();
  private readonly ownedRuns = new Set<NextclawRun>();
  private state: HarnessState = "idle";
  private kernel: NextclawHarnessResources | undefined;
  private startPromise: Promise<void> | undefined;
  private ownedKernel: AgentKernel | undefined;
  private preparePromise: Promise<void> | undefined;
  private readonly attachedModules: AgentKernelModule[] = [];

  constructor(private readonly options: NextclawHarnessOptions) {
    this.contributions = this.contributionRegistry;
    const sessions = new NextclawSessionRegistry(
      this.requireKernel,
      this.onRunCreated,
      this.onRunSettled,
      this.options.allowSlashCommands !== false,
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

  /** Opens the graph for host wiring without accepting Agent requests. */
  prepare = async (): Promise<void> => {
    if (this.state === "disposed") throw new NextclawHarnessError("lifecycle", "Harness has been disposed.");
    if (this.preparePromise) return this.preparePromise;
    if (this.ownedKernel) return;
    this.preparePromise = this.prepareInternal();
    try { await this.preparePromise; }
    finally { this.preparePromise = undefined; }
  };

  runTask = async (input: NextclawTaskInput): Promise<NextclawTaskResult> => {
    if (input.signal?.aborted) {
      throw new NextclawHarnessError("cancelled", "Task was cancelled.");
    }
    const agent = this.agents.get(input.agentId);
    const session = await this.resolveTaskSession(agent, input);
    const run = await session.run({
      input: input.input,
      channel: input.channel,
      model: input.model,
      signal: input.signal,
      onAssistantDelta: input.onAssistantDelta,
      onEvent: input.onEvent,
    });
    return await run.result();
  };

  listSessionMessages = async (sessionId: string) =>
    await this.requireKernel().sessionManager.listSessionMessages(sessionId);

  listUserQuestions = async (sessionId: string): Promise<NextclawUserQuestion[]> =>
    await this.requireKernel().userQuestions.list(sessionId);

  answerUserQuestion = async (input: {
    sessionId: string;
    questionId: string;
    action: "answer" | "dismiss";
    answer?: string;
    signal?: AbortSignal;
    onEvent?: NextclawTaskInput["onEvent"];
    onAssistantDelta?: NextclawTaskInput["onAssistantDelta"];
  }): Promise<NextclawUserQuestionReply> => {
    const kernel = this.requireKernel();
    let failure: unknown;
    let failed = false;
    let resolution: Awaited<ReturnType<typeof kernel.userQuestions.resolveAndWaitForReply>>;
    try {
      resolution = await kernel.userQuestions.resolveAndWaitForReply(input,
      new AgentRunClient({ eventBus: kernel.eventBus, ingress: kernel.ingress }), {
        abortSignal: input.signal,
        onEvent: input.onEvent,
        onAssistantDelta: input.onAssistantDelta,
      });
    } catch (error) {
      failed = true;
      failure = error;
    }
    try {
      await kernel.sessionManager.flushSession(input.sessionId);
    } catch (error) {
      throw new NextclawHarnessError("runtime_failure", "Question reply could not be persisted.",
        failed ? new AggregateError([failure, error], "Reply and persistence failed.") : error);
    }
    if (failed) throw failure;
    return { question: resolution!.question, text: resolution!.text };
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
    if (this.preparePromise) await this.preparePromise.catch(() => undefined);
    this.ownedKernel?.agentRunRequestManager.admissions.suspend();
    this.state = "disposed";
    this.kernel = undefined;
    const errors: unknown[] = [];
    for (const dispose of [
      this.disposeRuns,
      this.contributionRegistry.dispose,
      this.disposeKernel,
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

  private readonly requireKernel = (): NextclawHarnessResources => {
    if (this.state !== "started" || !this.kernel) {
      throw new NextclawHarnessError(
        "lifecycle",
        "Harness must be started before using this capability.",
      );
    }
    return this.kernel;
  };

  private startInternal = async (): Promise<void> => {
    try {
      await this.prepare();
      const kernel = this.ownedKernel!;
      await kernel.start(async () => {
        for (const module of this.attachedModules) await module.start();
        await this.contributionRegistry.start(kernel.capabilities);
      });
      this.kernel = kernel;
      for (const module of this.attachedModules) await module.ready?.();
      this.state = "started";
    } catch (error) {
      this.kernel = undefined;
      await this.contributionRegistry.stop().catch(() => undefined);
      try {
        await this.disposeKernel();
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

  private prepareInternal = async (): Promise<void> => {
    try {
      const resources = await this.options.platform.start();
      const kernel = this.ownedKernel = new AgentKernel(resources);
      for (const module of this.options.modules ?? []) {
        this.attachedModules.push(module);
        module.attach(kernel);
      }
    } catch (error) {
      await this.disposeKernel().catch(() => undefined);
      throw error;
    }
  };

  private disposeKernel = async (): Promise<void> => {
    const kernel = this.ownedKernel;
    this.ownedKernel = undefined;
    kernel?.agentRunRequestManager.admissions.suspend();
    const errors: unknown[] = [];
    const modules = this.attachedModules.splice(0).reverse();
    for (const dispose of [
      ...modules.map((module) => async () => { await module.stop?.(); }),
      async () => { await kernel?.dispose(); },
      ...modules.map((module) => () => module.dispose()),
      this.options.platform.dispose,
    ]) {
      try { await dispose(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Kernel resource cleanup failed.");
  };

  private resolveTaskSession = async (
    agent: INextclawAgent,
    input: NextclawTaskInput,
  ): Promise<INextclawSession> => {
    const sessionId = input.sessionId?.trim() || `exec:${crypto.randomUUID()}`;
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
