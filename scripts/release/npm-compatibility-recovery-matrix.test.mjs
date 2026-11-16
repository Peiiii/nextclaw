import assert from "node:assert/strict";
import test from "node:test";

import {
  NPM_COMPATIBILITY_MATRIX,
  resolveNpmCompatibilityRecoveryMatrix,
} from "./npm-compatibility-recovery-matrix.mjs";

const identity = { sourceCommit: "a".repeat(40), targetVersion: "0.59.4" };

test("uses the full compatibility matrix for a new immutable package identity", () => {
  const result = resolveNpmCompatibilityRecoveryMatrix({ isRecovery: false });
  assert.equal(result.reused, false);
  assert.equal(result.include.length, 16);
});

test("reruns only failed or cancelled compatibility jobs for a stable recovery", () => {
  for (const [platform, conclusion] of [["windows-x64", "failure"], ["darwin-arm64", "cancelled"]]) {
    const jobs = NPM_COMPATIBILITY_MATRIX.map((entry) => ({
      name: `verify NPM ${entry.platform} Node ${entry.node} @${identity.targetVersion}`,
      conclusion: entry.platform === platform ? conclusion : "success",
    }));
    const result = resolveNpmCompatibilityRecoveryMatrix({ isRecovery: true, jobs, ...identity });
    assert.equal(result.reused, false);
    assert.deepEqual(result.include.map((entry) => entry.platform), [
      platform, platform, platform, platform,
    ]);
  }
});

test("reuses a successful cell from an earlier run of the same immutable identity", () => {
  const windows20 = NPM_COMPATIBILITY_MATRIX.find((entry) =>
    entry.platform === "windows-x64" && entry.node === "20.19.0",
  );
  const jobs = [
    { name: `verify NPM ${windows20.platform} Node ${windows20.node} @${identity.targetVersion}`, conclusion: "success" },
    ...NPM_COMPATIBILITY_MATRIX.filter((entry) => entry !== windows20).map((entry) => ({
      name: `verify NPM ${entry.platform} Node ${entry.node} @${identity.targetVersion}`,
      conclusion: "failure",
    })),
    { name: `verify NPM ${windows20.platform} Node ${windows20.node} @${identity.targetVersion}`, conclusion: "cancelled" },
  ];
  const result = resolveNpmCompatibilityRecoveryMatrix({ isRecovery: true, jobs, ...identity });
  assert.equal(result.include.some((entry) => entry === windows20), false);
});

test("reuses complete immutable identity evidence without scheduling another matrix", () => {
  const jobs = NPM_COMPATIBILITY_MATRIX.map((entry) => ({
    name: `verify NPM ${entry.platform} Node ${entry.node} @${identity.targetVersion}`,
    conclusion: "success",
  }));
  assert.deepEqual(
    resolveNpmCompatibilityRecoveryMatrix({ isRecovery: true, jobs, ...identity }),
    {
      include: [{ node: "reused", os: "ubuntu-22.04", platform: "reused", reused: true }],
      reused: true,
    },
  );
});

test("rejects older-version evidence and only accepts legacy jobs from the exact immutable source", () => {
  const legacy = NPM_COMPATIBILITY_MATRIX.map(entry => ({ name: `verify NPM ${entry.platform} Node ${entry.node}`,
    conclusion: "success", sourceCommit: "b".repeat(40) }));
  const older = NPM_COMPATIBILITY_MATRIX.map(entry => ({ name: `verify NPM ${entry.platform} Node ${entry.node} @0.59.3`, conclusion: "success" }));
  const rejected = resolveNpmCompatibilityRecoveryMatrix({ isRecovery: true, jobs: [...legacy, ...older], ...identity });
  assert.equal(rejected.include.length, 16);
  assert.equal(rejected.reused, false);
  const accepted = legacy.map(job => ({ ...job, sourceCommit: identity.sourceCommit }));
  assert.equal(resolveNpmCompatibilityRecoveryMatrix({ isRecovery: true, jobs: accepted, ...identity }).reused, true);
  assert.throws(() => resolveNpmCompatibilityRecoveryMatrix({ isRecovery: true, jobs: accepted }), /immutable source/);
});

// Execute the production workflow script with the actual infrastructure failure shape.
const { readFileSync } = await import('node:fs');
const workflow = readFileSync(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8');
const recoveryScript = workflow.split('          script: |\n')[1].split('\n  resolve-release-identity:')[0]
  .split('\n').map(line => line.replace(/^            /, '')).join('\n');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
async function recover(overrides = {}) {
  const calls = [];
  const event = { id: 73, name: 'release', head_repository: { full_name: 'owner/repo' },
    head_branch: 'master', event: 'workflow_dispatch', run_attempt: 1, ...overrides.event };
  const run = { ...event, status: 'completed', conclusion: 'failure', ...overrides.run };
  const api = {
    getWorkflowRun: async () => ({data: run}),
    listJobsForWorkflowRunAttempt: 'jobs',
    downloadJobLogsForWorkflowRun: async () => ({data: overrides.log ?? ''}),
    reRunWorkflowFailedJobs: async args => calls.push(args),
  };
  const github = { rest: { actions: api, checks: {listAnnotations: 'annotations'} },
    paginate: async method => method === 'jobs' ? (overrides.jobs ?? [
      {name: 'verify NPM darwin-arm64 Node 24', conclusion: 'cancelled', runner_name: '', check_run_url: '/checks/24'},
      {name: 'summarize release state', conclusion: 'failure'},
    ]) : (overrides.annotations ?? [{message: 'The job was not acquired by Runner of type hosted even after multiple attempts'}]) };
  await new AsyncFunction('github', 'context', 'core', recoveryScript)(github,
    {repo: {owner: 'owner', repo: 'repo'}, payload: {workflow_run: event}}, {notice() {}});
  return calls;
}

test('capacity failure resumes the same run through failed-jobs API only', async () => {
  assert.deepEqual(await recover(), [{owner: 'owner', repo: 'repo', run_id: 73}]);
});
test('deterministic failure alongside capacity failure blocks recovery', async () => {
  assert.deepEqual(await recover({jobs: [{name: 'install test', conclusion: 'failure', runner_name: 'runner'}]}), []);
  assert.deepEqual(await recover({annotations: [{message: 'test assertion failed'}]}), []);
});
test('recovery refuses stale, exhausted, running, foreign, PR and cancelled runs', async () => {
  for (const override of [{run:{run_attempt:2}}, {event:{run_attempt:4}},
    {run:{status:'in_progress'}}, {event:{head_branch:'feature'}},
    {event:{head_repository:{full_name:'fork/repo'}}}, {event:{event:'pull_request'}},
    {run:{conclusion:'cancelled'}}]) assert.deepEqual(await recover(override), []);
});
test('docs connection timeout retries verification; content mismatch does not', async () => {
  const base = {event:{name:'Docs Deploy',event:'push'},
    jobs:[{name:'verify',conclusion:'failure',runner_name:'runner'}]};
  assert.equal((await recover({...base,log:'TypeError fetch failed; ConnectTimeoutError'})).length, 1);
  assert.deepEqual(await recover({...base,log:'manifest commit mismatch'}), []);
});
