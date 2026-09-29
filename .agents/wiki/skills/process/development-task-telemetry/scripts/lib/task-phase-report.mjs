import { emptyUsage, sumUsage } from "./codex-rollout-adapter.mjs";
import { PHASES } from "./task-phase-protocol.mjs";

const PARTIAL_WARNING_CODES = [
  "usage_unavailable",
  "invalid_marker",
  "invalid_marker_position",
  "multiple_markers",
  "state_conflict",
  "task_type_conflict",
  "flow_conflict",
  "root_end_with_active_children",
];

export function makeWarning(code, details = {}) {
  return { code, ...details };
}

export function timestampValue(value) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function sortedWarningCounts(map) {
  return Object.fromEntries(
    [...map.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

export class TaskAccumulator {
  constructor(taskId, rootThreadId) {
    this.id = taskId;
    this.name = null;
    this.type = null;
    this.flow = null;
    this.currentPhase = null;
    this.rootRetrospectiveSeen = false;
    this.rootThreadId = rootThreadId;
    this.rootStartCount = 0;
    this.reopenCount = 0;
    this.childThreads = new Set();
    this.activeChildren = new Set();
    this.phases = new Map();
    this.models = new Map();
    this.totalUsage = emptyUsage();
    this.unattributedUsage = emptyUsage();
    this.availableUsageFrames = 0;
    this.modelCalls = 0;
    this.toolCallRounds = 0;
    this.warningCounts = new Map();
    this.status = "incomplete";
    this.requestedStatus = null;
    this.startTimestamp = null;
    this.endTimestamp = null;
  }

  incrementWarning = (code) => {
    this.warningCounts.set(code, (this.warningCounts.get(code) ?? 0) + 1);
  };

  openPhase = (phase) => {
    let phaseReport = this.phases.get(phase);
    if (!phaseReport) {
      phaseReport = { phase, spanCount: 0, totalUsage: emptyUsage() };
      this.phases.set(phase, phaseReport);
    }
    phaseReport.spanCount += 1;
  };

  assignFrame = (phase, frame) => {
    this.modelCalls += 1;
    if (frame.hasToolCall) this.toolCallRounds += 1;

    const modelKey = `${frame.model}\u0000${frame.effort}`;
    let modelReport = this.models.get(modelKey);
    if (!modelReport) {
      modelReport = {
        model: frame.model,
        effort: frame.effort,
        modelCalls: 0,
        totalUsage: emptyUsage(),
      };
      this.models.set(modelKey, modelReport);
    }
    modelReport.modelCalls += 1;

    if (!frame.usage) {
      this.incrementWarning("usage_unavailable");
      return;
    }

    this.availableUsageFrames += 1;
    this.totalUsage = sumUsage(this.totalUsage, frame.usage);
    modelReport.totalUsage = sumUsage(modelReport.totalUsage, frame.usage);
    const phaseReport = this.phases.get(phase);
    if (phaseReport) {
      phaseReport.totalUsage = sumUsage(phaseReport.totalUsage, frame.usage);
    }
  };

  assignUnattributed = (frame) => {
    if (frame.usage) {
      this.unattributedUsage = sumUsage(this.unattributedUsage, frame.usage);
    }
  };

  finalize = () => {
    const denominator =
      this.totalUsage.total_tokens + this.unattributedUsage.total_tokens;
    const hasPartialData =
      this.status === "incomplete" ||
      this.unattributedUsage.total_tokens > 0 ||
      PARTIAL_WARNING_CODES.some(
        (code) => (this.warningCounts.get(code) ?? 0) > 0,
      );
    const dataQuality =
      this.availableUsageFrames === 0 && this.modelCalls > 0
        ? "unavailable"
        : hasPartialData
          ? "partial"
          : "complete";
    const phases = [...this.phases.values()]
      .sort(
        (left, right) =>
          PHASES.indexOf(left.phase) - PHASES.indexOf(right.phase),
      )
      .map((phase) => ({
        phase: phase.phase,
        span_count: phase.spanCount,
        total_usage: phase.totalUsage,
        share_of_task_tokens:
          this.totalUsage.total_tokens === 0
            ? null
            : phase.totalUsage.total_tokens / this.totalUsage.total_tokens,
      }));
    const models = [...this.models.values()]
      .sort(
        (left, right) =>
          left.model.localeCompare(right.model) ||
          left.effort.localeCompare(right.effort),
      )
      .map((model) => ({
        model: model.model,
        effort: model.effort,
        model_calls: model.modelCalls,
        total_tokens: model.totalUsage.total_tokens,
      }));

    return {
      id: this.id,
      name: this.name,
      type: this.type,
      flow: this.flow,
      current_phase: this.currentPhase,
      retrospective_observation:
        this.flow === null
          ? "unknown"
          : this.rootRetrospectiveSeen
            ? "entered"
            : this.status === "completed"
              ? "missing"
              : "pending",
      status: this.status,
      requested_status: this.requestedStatus,
      data_quality: dataQuality,
      started_at: this.startTimestamp,
      ended_at: this.endTimestamp,
      root_thread_id: this.rootThreadId,
      child_lane_count: this.childThreads.size,
      reopen_count: this.reopenCount,
      total_usage: this.totalUsage,
      unattributed_usage: this.unattributedUsage,
      mechanical_coverage:
        denominator === 0 ? null : this.totalUsage.total_tokens / denominator,
      model_calls: this.modelCalls,
      tool_call_rounds: this.toolCallRounds,
      task_elapsed_ms:
        this.startTimestamp && this.endTimestamp
          ? Math.max(
              0,
              timestampValue(this.endTimestamp) -
                timestampValue(this.startTimestamp),
            )
          : null,
      phases,
      models,
      warning_counts: sortedWarningCounts(this.warningCounts),
    };
  };
}
