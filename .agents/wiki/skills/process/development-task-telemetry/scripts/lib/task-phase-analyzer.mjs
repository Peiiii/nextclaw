import { resolve } from "node:path";

import {
  emptyUsage,
  parseRollout,
  sumUsage,
} from "./codex-rollout-adapter.mjs";
import { PROTOCOL } from "./task-phase-protocol.mjs";
import { TaskAccumulator, makeWarning, timestampValue } from "./task-phase-report.mjs";

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
    const markers =
      frame.marker.kind === "markers" ? frame.marker.markers : [frame.marker];
    for (const marker of markers) {
      if (marker.kind !== "marker" || marker.action !== "start") continue;
      const rootThreads = roots.get(marker.taskId) ?? new Set();
      rootThreads.add(frame.threadId);
      roots.set(marker.taskId, rootThreads);
    }
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

    const applyMarker = (marker, assignFrame) => {
      let task = state.taskId ? ensureTask(state.taskId) : null;
      let attributed = false;
      const assign = (phase) => {
        if (!assignFrame) return;
        task.assignFrame(phase, frame);
        attributed = true;
      };
      const assignUnattributed = () => {
        if (task && assignFrame) task.assignUnattributed(frame);
      };

      if (marker.kind === "invalid") {
        if (task) {
          assignUnattributed();
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
          assignUnattributed();
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
          if (
            task.type !== null &&
            marker.taskType !== null &&
            task.type !== marker.taskType
          ) {
            task.incrementWarning("task_type_conflict");
          } else task.type ??= marker.taskType;
          if (
            task.flow !== null &&
            marker.flow !== null &&
            task.flow !== marker.flow
          ) {
            task.incrementWarning("flow_conflict");
          } else task.flow ??= marker.flow ?? null;
          task.rootStartCount += 1;
          task.reopenCount = Math.max(0, task.rootStartCount - 1);
          task.status = "incomplete";
          task.startTimestamp ??= frame.timestamp;
          task.currentPhase = marker.phase;
          task.rootRetrospectiveSeen = marker.phase === "retrospective";
          state.activate(marker.taskId, marker.phase, "root");
          task.openPhase(marker.phase);
          assign(marker.phase);
        }
      } else if (marker.kind === "marker" && marker.action === "join") {
      const rootThreads = roots.get(marker.taskId);
      if (rootThreads?.size !== 1 || state.mode === "active") {
        assignUnattributed();
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
        assign(marker.phase);
      }
      } else if (marker.kind === "marker" && marker.action === "phase") {
      if (state.mode !== "active" || !task) {
        assignUnattributed();
        state.desynchronize(task, "state_conflict");
        globalWarnings.push(
          makeWarning("state_conflict", {
            thread_id: frame.threadId,
            timestamp: frame.timestamp,
          }),
        );
      } else {
        if (marker.flow) {
          if (task.flow !== null && task.flow !== marker.flow)
            task.incrementWarning("flow_conflict");
          else task.flow ??= marker.flow;
        }
        if (state.phase === marker.phase)
          task.incrementWarning("duplicate_phase");
        else {
          state.phase = marker.phase;
          task.openPhase(marker.phase);
        }
        if (state.laneType === "root") {
          task.currentPhase = state.phase;
          if (state.phase === "retrospective")
            task.rootRetrospectiveSeen = true;
        }
        assign(state.phase);
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
        assignUnattributed();
        state.desynchronize(task, "state_conflict");
        globalWarnings.push(
          makeWarning("state_conflict", {
            thread_id: frame.threadId,
            task_id: marker.taskId,
            timestamp: frame.timestamp,
          }),
        );
      } else {
        assign(state.phase);
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
        assign(state.phase);
      } else if (state.mode === "desynchronized" && task && assignFrame) {
        assignUnattributed();
      }

      return attributed;
    };

    const markers =
      frame.marker.kind === "markers" ? frame.marker.markers : [frame.marker];
    const attributed = markers.some((marker, index) =>
      applyMarker(marker, index === markers.length - 1),
    );

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
