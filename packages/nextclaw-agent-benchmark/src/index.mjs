export {
  BENCHMARK_VERSION, PRICE_SNAPSHOT, RequestBudget, comparePrefix, compareReports,
  estimateCost, hash, pricesAt, readUsage, summarizeCalls,
} from "./measurement/usage.utils.mjs";
export { TASK_FIXTURES, fixtureIdentity, prepareTaskFixture, verifyTaskFixture } from "./tasks/fixtures.config.mjs";
export { DEFAULT_EXPECTED_REPLY, buildStablePrompt } from "./tasks/fixed-prefix.utils.mjs";

export async function installNextclawBenchmarkObserver() {
  await import("./measurement/request-observer.manager.mjs");
  await import("openai/shims/web");
}

export async function createDiagnosticRunner(options) {
  const { HarnessPromptCacheSmokeRunner } = await import("./diagnostics/task-suite.manager.mjs");
  return new HarnessPromptCacheSmokeRunner(options);
}
