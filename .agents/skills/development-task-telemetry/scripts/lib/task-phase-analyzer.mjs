import { resolve } from "node:path";

import {
  emptyUsage,
  parseRollout,
  sumUsage,
} from "./codex-rollout-adapter.mjs";
import { PHASES, PROTOCOL } from "./task-phase-protocol.mjs";

const PARTIAL_WARNING_CODES = [
  "usage_unavailable",
  "invalid_marker",
  "invalid_marker_position",
  "multiple_markers",
  "state_conflict",
  "root_end_with_active_children",
];

function makeWarning(code, details = {}) {
  return { code, ...details };
}

function timestampValue(value) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function sortedWarningCounts(map) {
  return Object.fromEntries(
    [...map.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

class TaskAccumulator {
  constructor(taskId, rootThreadId) {
    this.id = taskId;
    this.name = null;
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

class ThreadState {
  constructor(threadId) {
    this.threadId = threadId;
    this.mode = "inactive";
    this.taskId = null;
    this.phase = null;
    this.laneType = null;
    this.hasTrackedTask = false;
  }

  desynchronize = (task, code) => {
    this.mode = "desynchronized";
    task?.incrementWarning(code);
  };

  activate = (taskId, phase, laneType) => {
    this.mode = "active";
    this.taskId = taskId;
    this.phase = phase;
    this.laneType = laneType;
    this.hasTrackedTask = true;
  };

  close = () => {
    this.mode = "inactive";
    this.taskId = null;
    this.phase = null;
    this.laneType = null;
  };
}

export async function analyzeRollouts(paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error("At least one rollout path is required");
  }

  const rollouts = await Promise.all(
    paths.map((path, index) => parseRollout(resolve(path), index)),
  );
  return analyzeParsedRollouts(rollouts);
}

export function analyzeParsedRollouts(rollouts) {
  if (!Array.isArray(rollouts) || rollouts.length === 0) {
    throw new Error("At least one parsed rollout is required");
  }
  const globalWarnings = rollouts.flatMap((rollout) => rollout.warnings);
  const frames = rollouts
    .flatMap((rollout, fileOrder) =>
      rollout.frames.map((frame) => ({ ...frame, fileOrder })),
    )
    .sort(
      (left, right) =>
        timestampValue(left.timestamp) - timestampValue(right.timestamp) ||
        left.fileOrder - right.fileOrder ||
        left.frameIndex - right.frameIndex,
    );

  const roots = new Map();
  for (const frame of frames) {
    if (frame.marker.kind !== "marker" || frame.marker.action !== "start")
      continue;
    const rootThreads = roots.get(frame.marker.taskId) ?? new Set();
    rootThreads.add(frame.threadId);
    roots.set(frame.marker.taskId, rootThreads);
  }
  for (const [taskId, rootThreads] of roots) {
    if (rootThreads.size > 1) {
      globalWarnings.push(
        makeWarning("root_task_id_conflict", {
          task_id: taskId,
          threads: [...rootThreads].sort(),
        }),
      );
    }
  }

  const tasks = new Map();
  const threadStates = new Map();
  let corpusObserved = emptyUsage();
  let corpusAttributed = emptyUsage();
  let corpusUnattributed = emptyUsage();
  let preStartUnattributed = emptyUsage();

  const ensureTask = (taskId) => {
    let task = tasks.get(taskId);
    if (!task) {
      const rootThreads = roots.get(taskId);
      const rootThreadId = rootThreads?.size === 1 ? [...rootThreads][0] : null;
      task = new TaskAccumulator(taskId, rootThreadId);
      tasks.set(taskId, task);
    }
    return task;
  };

  for (const frame of frames) {
    const state =
      threadStates.get(frame.threadId) ?? new ThreadState(frame.threadId);
    threadStates.set(frame.threadId, state);
    if (frame.usage) corpusObserved = sumUsage(corpusObserved, frame.usage);

    for (const frameWarning of frame.warnings) {
      globalWarnings.push({ ...frameWarning, thread_id: frame.threadId });
      if (state.taskId)
        ensureTask(state.taskId).incrementWarning(frameWarning.code);
    }

    let task = state.taskId ? ensureTask(state.taskId) : null;
    let attributed = false;
    const marker = frame.marker;

    if (marker.kind === "invalid") {
      if (task) {
        task.assignUnattributed(frame);
        state.desynchronize(task, marker.code);
      }
      globalWarnings.push(
        makeWarning(marker.code, {
          thread_id: frame.threadId,
          timestamp: frame.timestamp,
        }),
      );
    } else if (marker.kind === "marker" && marker.action === "start") {
      const rootThreads = roots.get(marker.taskId);
      const rootIsUnique =
        rootThreads?.size === 1 && rootThreads.has(frame.threadId);
      if (
        !rootIsUnique ||
        (state.mode === "active" && state.taskId !== marker.taskId)
      ) {
        if (task) task.assignUnattributed(frame);
        state.desynchronize(task, "state_conflict");
        globalWarnings.push(
          makeWarning("state_conflict", {
            thread_id: frame.threadId,
            task_id: marker.taskId,
            timestamp: frame.timestamp,
          }),
        );
      } else {
        task = ensureTask(marker.taskId);
        task.name ??= marker.taskName;
        task.rootStartCount += 1;
        task.reopenCount = Math.max(0, task.rootStartCount - 1);
        task.status = "incomplete";
        task.startTimestamp ??= frame.timestamp;
        state.activate(marker.taskId, marker.phase, "root");
        task.openPhase(marker.phase);
        task.assignFrame(marker.phase, frame);
        attributed = true;
      }
    } else if (marker.kind === "marker" && marker.action === "join") {
      const rootThreads = roots.get(marker.taskId);
      if (rootThreads?.size !== 1 || state.mode === "active") {
        if (task) task.assignUnattributed(frame);
        state.desynchronize(task, "unresolved_join");
        globalWarnings.push(
          makeWarning("unresolved_join", {
            thread_id: frame.threadId,
            task_id: marker.taskId,
            timestamp: frame.timestamp,
          }),
        );
      } else {
        task = ensureTask(marker.taskId);
        task.childThreads.add(frame.threadId);
        task.activeChildren.add(frame.threadId);
        state.activate(marker.taskId, marker.phase, "child");
        task.openPhase(marker.phase);
        task.assignFrame(marker.phase, frame);
        attributed = true;
      }
    } else if (marker.kind === "marker" && marker.action === "phase") {
      if (state.mode !== "active" || !task) {
        if (task) task.assignUnattributed(frame);
        state.desynchronize(task, "state_conflict");
        globalWarnings.push(
          makeWarning("state_conflict", {
            thread_id: frame.threadId,
            timestamp: frame.timestamp,
          }),
        );
      } else {
        if (state.phase === marker.phase)
          task.incrementWarning("duplicate_phase");
        else {
          state.phase = marker.phase;
          task.openPhase(marker.phase);
        }
        task.assignFrame(state.phase, frame);
        attributed = true;
      }
    } else if (
      marker.kind === "marker" &&
      (marker.action === "leave" || marker.action === "end")
    ) {
      const expectedLane = marker.action === "leave" ? "child" : "root";
      if (
        state.mode !== "active" ||
        !task ||
        state.taskId !== marker.taskId ||
        state.laneType !== expectedLane
      ) {
        if (task) task.assignUnattributed(frame);
        state.desynchronize(task, "state_conflict");
        globalWarnings.push(
          makeWarning("state_conflict", {
            thread_id: frame.threadId,
            task_id: marker.taskId,
            timestamp: frame.timestamp,
          }),
        );
      } else {
        task.assignFrame(state.phase, frame);
        attributed = true;
        if (marker.action === "leave") {
          task.activeChildren.delete(frame.threadId);
          if (marker.status !== "completed")
            task.incrementWarning("child_noncompleted");
        } else {
          task.requestedStatus = marker.status;
          task.endTimestamp = frame.timestamp;
          if (marker.status === "completed" && task.activeChildren.size > 0) {
            task.status = "incomplete";
            task.incrementWarning("root_end_with_active_children");
          } else task.status = marker.status;
        }
        state.close();
      }
    } else if (state.mode === "active" && task) {
      task.assignFrame(state.phase, frame);
      attributed = true;
    } else if (state.mode === "desynchronized" && task) {
      task.assignUnattributed(frame);
    }

    if (frame.usage) {
      if (attributed)
        corpusAttributed = sumUsage(corpusAttributed, frame.usage);
      else {
        corpusUnattributed = sumUsage(corpusUnattributed, frame.usage);
        if (!state.hasTrackedTask) {
          preStartUnattributed = sumUsage(preStartUnattributed, frame.usage);
        }
      }
    }
  }

  for (const state of threadStates.values()) {
    if (state.mode === "active" && state.taskId) {
      ensureTask(state.taskId).incrementWarning("incomplete_lane");
    }
  }

  const finalizedTasks = [...tasks.values()]
    .map((task) => task.finalize())
    .sort((left, right) => left.id.localeCompare(right.id));
  const observedTotal = corpusObserved.total_tokens;

  return {
    protocol: PROTOCOL,
    generated_from: rollouts.map((rollout) => resolve(rollout.path)).sort(),
    tasks: finalizedTasks,
    corpus: {
      observed_usage: corpusObserved,
      attributed_usage: corpusAttributed,
      unattributed_usage: corpusUnattributed,
      pre_start_unattributed: preStartUnattributed,
      mechanical_coverage:
        observedTotal === 0
          ? null
          : corpusAttributed.total_tokens / observedTotal,
    },
    warnings: globalWarnings.sort(
      (left, right) =>
        left.code.localeCompare(right.code) ||
        String(left.thread_id ?? "").localeCompare(
          String(right.thread_id ?? ""),
        ) ||
        String(left.timestamp ?? "").localeCompare(
          String(right.timestamp ?? ""),
        ),
    ),
  };
}
