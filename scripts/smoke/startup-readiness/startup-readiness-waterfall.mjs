function formatMaybeMs(value) {
  return value === null ? "-" : `${value}ms`;
}

function collectObservedMilestones(run) {
  return [
    ["uiApi", run.uiApiReachableMs],
    ["authStatus", run.authStatusOkMs],
    ["health", run.healthOkMs],
    ["ncpReady", run.ncpAgentReadyMs],
    ["bootstrapReady", run.bootstrapReadyMs],
    ["frontendServer", run.frontendServerReadyMs],
    ["frontendAuthStatus", run.frontendAuthStatusOkMs],
    ["pluginHydrationReady", run.pluginHydrationReadyMs],
    ["channelsReady", run.channelsReadyMs],
  ]
    .filter(([, value]) => Number.isFinite(value))
    .sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0]));
}

function collectTraceWaterfall(run) {
  return run.startupTrace
    .map((trace) => {
      const durationMs = Number.parseInt(trace.fields.duration_ms ?? "", 10);
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        return null;
      }
      if (trace.step === "service.deferred_startup.post_ready_delay") {
        return {
          durationMs,
          endMs: trace.elapsedMs + durationMs,
          startMs: trace.elapsedMs,
          step: trace.step,
        };
      }
      return {
        durationMs,
        endMs: trace.elapsedMs,
        startMs: Math.max(0, trace.elapsedMs - durationMs),
        step: trace.step,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);
}

export function printRunWaterfall(run) {
  const milestones = collectObservedMilestones(run);
  if (milestones.length > 0) {
    console.log("  observed milestones:");
    for (const [name, value] of milestones) {
      console.log(`    ${formatMaybeMs(value).padStart(8)}  ${name}`);
    }
  }

  const traceWaterfall = collectTraceWaterfall(run);
  if (traceWaterfall.length === 0) {
    return;
  }
  console.log("  startup trace waterfall:");
  for (const span of traceWaterfall) {
    console.log(
      `    ${String(span.startMs).padStart(6)}-${String(span.endMs).padEnd(6)} ${String(span.durationMs).padStart(6)}ms  ${span.step}`
    );
  }
}
