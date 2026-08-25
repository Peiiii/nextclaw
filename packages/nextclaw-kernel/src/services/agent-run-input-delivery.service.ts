import type {
  AgentRuntimeManager,
} from "@kernel/managers/agent-runtime.manager.js";
import type {
  SessionRun,
  SessionRunPendingRequest,
  SessionRunManager,
  SessionRunQueuedRequest,
} from "@kernel/managers/session-run.manager.js";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import type {
  SessionPendingInput,
  SessionQueuedInput,
  SessionSteerQueuedInputResult,
} from "@kernel/types/agent-run.types.js";
import type { AgentRunSession } from "@kernel/types/session.types.js";

/** Resolves public pending-input actions while SessionRun remains the state owner. */
export class AgentRunInputDeliveryService {
  constructor(
    private readonly agentRuntimeManager: AgentRuntimeManager,
    private readonly sessionManager: SessionManager,
    private readonly sessionRunManager: SessionRunManager,
    private readonly publishQueueUpdated: (sessionId: string) => void,
  ) {}

  listQueuedInputs = (sessionId: string): readonly SessionQueuedInput[] => {
    const sessionRun = this.sessionRunManager.getSessionRun(sessionId);
    return sessionRun?.listQueuedRequests().map(this.toQueuedInput) ?? [];
  };

  removeQueuedInput = (
    sessionId: string,
    queuedInputId: string,
  ): SessionQueuedInput | null => {
    const sessionRun = this.sessionRunManager.getSessionRun(sessionId);
    const removed = sessionRun?.removeQueuedRequest(queuedInputId) ?? null;
    if (!removed) return null;
    this.publishQueueUpdated(sessionId);
    return this.toQueuedInput(removed);
  };

  listPendingInputs = (sessionId: string): readonly SessionPendingInput[] => {
    const sessionRun = this.sessionRunManager.getSessionRun(sessionId);
    return sessionRun?.listPendingRequests().map((request) => ({
      ...this.toQueuedInput(request),
      placement: request.placement,
      intendedRunId: request.intendedRunId,
    })) ?? [];
  };

  steerQueuedInput = async (
    sessionId: string,
    queuedInputId: string,
  ): Promise<SessionSteerQueuedInputResult> => {
    const sessionRun = this.sessionRunManager.getSessionRun(sessionId);
    if (!sessionRun?.getActiveRunId()) return { ok: false, reason: "unavailable" };
    if (!sessionRun.listQueuedRequests().some(({ id }) => id === queuedInputId)) {
      return { ok: false, reason: "not-found" };
    }
    if (!await this.supportsNextStepInput(sessionRun)) {
      return { ok: false, reason: "unavailable" };
    }
    const moved = sessionRun.moveQueuedRequestToNextStep(queuedInputId);
    if (!moved) return { ok: false, reason: "unavailable" };
    this.publishQueueUpdated(sessionId);
    return { ok: true, input: this.toPendingInput(moved) };
  };

  promotePreferredSteeringInput = (
    sessionRun: SessionRun,
    queuedInputId: string,
    session: AgentRunSession,
  ): SessionRunPendingRequest | null => {
    try {
      const runtime = this.agentRuntimeManager.getOrCreate({
        agentRuntimeId: session.agentRuntimeId,
        session,
        sessionRun,
      });
      if (runtime.capabilities?.nextStepInput !== true) return null;
      return sessionRun.moveQueuedRequestToNextStep(queuedInputId);
    } catch {
      return null;
    }
  };

  private supportsNextStepInput = async (sessionRun: SessionRun): Promise<boolean> => {
    try {
      const session = await this.sessionManager.getAgentRunSession(sessionRun.sessionId);
      const runtime = this.agentRuntimeManager.getOrCreate({
        agentRuntimeId: session.agentRuntimeId,
        session,
        sessionRun,
      });
      return runtime.capabilities?.nextStepInput === true;
    } catch {
      return false;
    }
  };

  private toPendingInput = (request: SessionRunPendingRequest): SessionPendingInput => ({
    ...this.toQueuedInput(request),
    placement: "steering",
    intendedRunId: request.intendedRunId,
  });

  private toQueuedInput = (
    queuedRequest: Pick<SessionRunQueuedRequest, "id" | "enqueuedAt" | "request">,
  ): SessionQueuedInput => ({
    id: queuedRequest.id,
    sessionId: queuedRequest.request.message.sessionId,
    enqueuedAt: queuedRequest.enqueuedAt,
    message: structuredClone(queuedRequest.request.message),
    metadata: structuredClone(queuedRequest.request.metadata ?? {}),
  });
}
