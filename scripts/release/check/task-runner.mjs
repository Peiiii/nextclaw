import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { resolveReleaseCheckStepSpecs } from "./steps.mjs";

const STEP_PRIORITY = {
  build: 0,
  tsc: 1,
  lint: 2
};
const DEFAULT_SHELL = process.env.SHELL ?? "/bin/sh";

function formatDuration(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function isStepCached(params) {
  const { checkpoint, entry, fingerprint, stepSpec } = params;
  const packageState = checkpoint.packages[entry.pkg.name];
  const stepState = packageState?.steps?.[stepSpec.stepName];
  return (
    stepState?.status === "passed" &&
    stepState.fingerprint === fingerprint &&
    stepState.command === stepSpec.command &&
    packageState.version === entry.pkg.version
  );
}

function recordStepState(params) {
  const { checkpoint, entry, status, fingerprint, stepSpec, durationMs } = params;
  const packageState =
    checkpoint.packages[entry.pkg.name] ??
    (checkpoint.packages[entry.pkg.name] = {
      version: entry.pkg.version,
      packageDir: entry.packageDir,
      steps: {}
    });

  packageState.version = entry.pkg.version;
  packageState.packageDir = entry.packageDir;
  packageState.steps[stepSpec.stepName] = {
    status,
    command: stepSpec.command,
    fingerprint,
    finishedAt: new Date().toISOString(),
    durationMs
  };
}

export function createPackageStates(params) {
  return new Map(
    params.orderedBatchPackages.map((entry) => {
      const dependencyNames = [...(params.dependencyMap.get(entry.pkg.name) ?? [])].sort();
      const stepSpecs = resolveReleaseCheckStepSpecs(entry, {
        includeLint: params.includeLint
      });
      const dependencyGateStepCount = stepSpecs.filter((stepSpec) => stepSpec.requiresDependencyGate).length;
      return [
        entry.pkg.name,
        {
          entry,
          dependencyNames,
          fingerprint: params.fingerprints.get(entry.pkg.name) ?? "",
          priorityScore: params.priorityScores.get(entry.pkg.name) ?? 0,
          stepSpecs,
          pendingStepNames: new Set(stepSpecs.map((stepSpec) => stepSpec.stepName)),
          activeStepNames: new Set(),
          completedStepNames: new Set(),
          completedDependencyGateStepCount: 0,
          dependencyGateStepCount
        }
      ];
    })
  );
}

function markStepCompleted(packageState, stepSpec) {
  if (packageState.completedStepNames.has(stepSpec.stepName)) {
    return;
  }
  packageState.pendingStepNames.delete(stepSpec.stepName);
  packageState.activeStepNames.delete(stepSpec.stepName);
  packageState.completedStepNames.add(stepSpec.stepName);
  if (stepSpec.requiresDependencyGate) {
    packageState.completedDependencyGateStepCount += 1;
  }
}

function isPackageDependencyGateOpen(packageState) {
  return packageState.completedDependencyGateStepCount >= packageState.dependencyGateStepCount;
}

function arePackageDependenciesReady(packageState, packageStates) {
  return packageState.dependencyNames.every((dependencyName) =>
    isPackageDependencyGateOpen(packageStates.get(dependencyName))
  );
}

function buildTaskDescriptors(packageStates) {
  return [...packageStates.values()].flatMap((packageState) =>
    packageState.stepSpecs.map((stepSpec) => ({
      taskId: `${packageState.entry.pkg.name}:${stepSpec.stepName}`,
      packageName: packageState.entry.pkg.name,
      stepSpec
    }))
  );
}

function compareTaskPriority(left, right, packageStates) {
  const leftState = packageStates.get(left.packageName);
  const rightState = packageStates.get(right.packageName);
  const dependencyBias = Number(left.stepSpec.requiresDependencyGate) - Number(right.stepSpec.requiresDependencyGate);
  if (dependencyBias !== 0) {
    return dependencyBias > 0 ? -1 : 1;
  }

  const priorityDelta = (rightState?.priorityScore ?? 0) - (leftState?.priorityScore ?? 0);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return STEP_PRIORITY[left.stepSpec.stepName] - STEP_PRIORITY[right.stepSpec.stepName];
}

function canStartTask(taskDescriptor, activeStepCounts, stepConcurrency) {
  const activeCount = activeStepCounts.get(taskDescriptor.stepSpec.stepName) ?? 0;
  const stepLimit = stepConcurrency[taskDescriptor.stepSpec.stepName];
  if (typeof stepLimit !== "number") {
    return true;
  }
  return activeCount < stepLimit;
}

function findNextReadyTask(taskDescriptors, packageStates, activeStepCounts, stepConcurrency) {
  return taskDescriptors
    .filter((taskDescriptor) => {
      const packageState = packageStates.get(taskDescriptor.packageName);
      if (!packageState) {
        return false;
      }
      if (
        !packageState.pendingStepNames.has(taskDescriptor.stepSpec.stepName) ||
        packageState.activeStepNames.has(taskDescriptor.stepSpec.stepName) ||
        packageState.completedStepNames.has(taskDescriptor.stepSpec.stepName)
      ) {
        return false;
      }
      if (!taskDescriptor.stepSpec.requiresDependencyGate) {
        return canStartTask(taskDescriptor, activeStepCounts, stepConcurrency);
      }
      return (
        arePackageDependenciesReady(packageState, packageStates) &&
        canStartTask(taskDescriptor, activeStepCounts, stepConcurrency)
      );
    })
    .sort((left, right) => compareTaskPriority(left, right, packageStates))[0];
}

function skipStep(params) {
  const { entry, packageState, reason, stepSpec } = params;
  console.log(`[release:check] skip ${entry.pkg.name} ${stepSpec.stepName} (${reason})`);
  markStepCompleted(packageState, stepSpec);
}

function killActiveChildren(activeChildren) {
  for (const child of activeChildren) {
    if (child.killed) {
      continue;
    }
    child.kill("SIGTERM");
    setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }, 5000).unref();
  }
}

function spawnStepProcess(entry, stepSpec) {
  return spawn("pnpm", ["-C", entry.packageDir, "exec", DEFAULT_SHELL, "-lc", stepSpec.command], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env
  });
}

function runStepTask(params) {
  return new Promise((resolve, reject) => {
    const { entry, fingerprint, stepSpec } = params;
    console.log(`[release:check] start ${entry.pkg.name} ${stepSpec.stepName}`);
    const startedAt = performance.now();
    const child = spawnStepProcess(entry, stepSpec);
    params.activeChildren.add(child);

    child.on("error", (error) => {
      params.activeChildren.delete(child);
      const duration = performance.now() - startedAt;
      recordStepState({
        checkpoint: params.checkpoint,
        entry,
        stepSpec,
        status: "failed",
        fingerprint,
        durationMs: duration
      });
      params.saveCheckpoint();
      params.packageState.activeStepNames.delete(stepSpec.stepName);
      reject(error);
    });

    child.on("exit", (code, signal) => {
      params.activeChildren.delete(child);
      const duration = performance.now() - startedAt;
      const status = code === 0 ? "passed" : "failed";

      recordStepState({
        checkpoint: params.checkpoint,
        entry,
        stepSpec,
        status,
        fingerprint,
        durationMs: duration
      });
      params.saveCheckpoint();

      if (code === 0) {
        markStepCompleted(params.packageState, stepSpec);
        console.log(
          `[release:check] done ${entry.pkg.name} ${stepSpec.stepName} in ${formatDuration(duration)}`
        );
        resolve();
        return;
      }

      params.packageState.activeStepNames.delete(stepSpec.stepName);
      reject(
        new Error(
          `[release:check] failed ${entry.pkg.name} ${stepSpec.stepName} after ${formatDuration(duration)}${signal ? ` (signal: ${signal})` : ""}`
        )
      );
    });
  });
}

export function hydrateCachedSteps(params) {
  for (const packageState of params.packageStates.values()) {
    for (const stepSpec of packageState.stepSpecs) {
      if (
        isStepCached({
          checkpoint: params.checkpoint,
          entry: packageState.entry,
          fingerprint: packageState.fingerprint,
          stepSpec
        })
      ) {
        skipStep({
          entry: packageState.entry,
          packageState,
          reason: "cached success",
          stepSpec
        });
      }
    }
  }
}

export async function runTaskScheduler(params) {
  const { checkpoint, concurrency, packageStates, saveCheckpoint, stepConcurrency } = params;
  const taskDescriptors = buildTaskDescriptors(packageStates);
  const activeTasks = new Map();
  const activeChildren = new Set();
  const activeStepCounts = new Map();
  let failure = null;

  while (true) {
    if (failure) {
      killActiveChildren(activeChildren);
      throw failure;
    }

    while (activeTasks.size < concurrency) {
      const nextTask = findNextReadyTask(
        taskDescriptors,
        packageStates,
        activeStepCounts,
        stepConcurrency
      );
      if (!nextTask) {
        break;
      }
      const packageState = packageStates.get(nextTask.packageName);
      if (!packageState) {
        break;
      }
      packageState.activeStepNames.add(nextTask.stepSpec.stepName);
      activeStepCounts.set(
        nextTask.stepSpec.stepName,
        (activeStepCounts.get(nextTask.stepSpec.stepName) ?? 0) + 1
      );
      const taskPromise = runStepTask({
        activeChildren,
        checkpoint,
        entry: packageState.entry,
        fingerprint: packageState.fingerprint,
        packageState,
        saveCheckpoint,
        stepSpec: nextTask.stepSpec
      })
        .catch((error) => {
          failure = error;
          throw error;
        })
        .finally(() => {
          const nextCount = (activeStepCounts.get(nextTask.stepSpec.stepName) ?? 1) - 1;
          if (nextCount <= 0) {
            activeStepCounts.delete(nextTask.stepSpec.stepName);
          } else {
            activeStepCounts.set(nextTask.stepSpec.stepName, nextCount);
          }
          activeTasks.delete(nextTask.taskId);
        });
      activeTasks.set(nextTask.taskId, taskPromise);
    }

    if (activeTasks.size === 0) {
      const hasPendingTasks = [...packageStates.values()].some(
        (packageState) => packageState.pendingStepNames.size > 0
      );
      if (hasPendingTasks) {
        throw new Error(
          "[release:check] scheduler deadlocked before all package steps became runnable"
        );
      }
      return;
    }

    try {
      await Promise.race(activeTasks.values());
    } catch {
      // failure is recorded above and handled at the top of the loop
    }
  }
}
