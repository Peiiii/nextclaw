import assert from "node:assert/strict";
import test from "node:test";

import {
  NPM_COMPATIBILITY_MATRIX,
  groupNpmCompatibilityMatrix,
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
const workflow = readFileSync(new URL('../../.github/workflows/release-recovery.yml', import.meta.url), 'utf8');
const recoveryScript = workflow.split('          script: |\n')[1]
  .split('\n').map(line => line.replace(/^            /, '')).join('\n');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
async function recover(overrides = {}) {
  const calls = [];
  const event = { id: 73, name: 'release', path: '.github/workflows/release.yml', head_repository: { full_name: 'owner/repo' },
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
  await new AsyncFunction('github', 'context', 'core', 'fetch', recoveryScript)(github,
    {repo: {owner: 'owner', repo: 'repo'}, payload: overrides.manual ? {inputs:{run_id:'73'}} : {workflow_run: event}}, {notice() {}},
    async url => {
      if (overrides.expectUrl) assert.equal(url, overrides.expectUrl);
      return {ok:overrides.registry !== undefined,json:async()=>overrides.registry};
    });
  return calls;
}

test('capacity failure resumes the same run through failed-jobs API only', async () => {
  assert.deepEqual(await recover(), [{owner: 'owner', repo: 'repo', run_id: 73}]);
  assert.equal((await recover({event:{name:'feedback-dynamic-title'}})).length,1);
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
  const base = {event:{name:'Docs Deploy',path:'.github/workflows/docs-deploy.yml',event:'push'},
    jobs:[{name:'verify',conclusion:'failure',runner_name:'runner'}]};
  assert.equal((await recover({...base,log:'TypeError fetch failed; ConnectTimeoutError'})).length, 1);
  assert.deepEqual(await recover({...base,log:'manifest commit mismatch'}), []);
});


test('preparation resumes only when the exact missing registry version is now available', async () => {
  const base={event:{name:'npm-release-prepare source=frozen dispatch=push',path:'.github/workflows/npm-release-prepare.yml',event:'push'},
    jobs:[{name:'prepare runtime darwin',conclusion:'failure',runner_name:'runner'}],
    log:'ERR_PNPM_NO_MATCHING_VERSION No matching version found for @typescript-eslint/types@8.73.0'};
  const registry={name:'@typescript-eslint/types',version:'8.73.0'};
  assert.equal((await recover({...base,registry,expectUrl:'https://registry.npmjs.org/%40typescript-eslint%2Ftypes/8.73.0'})).length,1);
  assert.deepEqual(await recover(base),[]);
  assert.deepEqual(await recover({...base,registry:{...registry,version:'8.72.2'}}),[]);
  assert.deepEqual(await recover({...base,log:'build failed',registry}),[]);
  assert.deepEqual(await recover({...base,event:{...base.event,path:'.github/workflows/untrusted.yml'},registry}),[]);
  assert.equal((await recover({...base,registry,manual:true})).length,1);
  assert.deepEqual(await recover({...base,registry,manual:true,run:{status:'in_progress'}}),[]);
});


test('one allocation per platform covers all sixteen cells exactly once', () => {
  const groups=groupNpmCompatibilityMatrix();
  assert.equal(groups.length,4);
  assert.deepEqual(groups.flatMap(g=>g.nodes.map(node=>({node,os:g.os,platform:g.platform,reused:false}))),NPM_COMPATIBILITY_MATRIX);
  for (const group of groups) assert.equal(group.node,group.nodes.join(','));
  assert.throws(()=>groupNpmCompatibilityMatrix([{platform:'darwin-arm64',node:'99'}]),/Invalid/);
});
test('groups only unresolved cells and retains completed grouped evidence', () => {
  const groups=groupNpmCompatibilityMatrix();
  const jobs=groups.map(g=>({name:`verify-npm-node-compatibility / verify NPM ${g.platform} Node ${g.node} @${identity.targetVersion}`,conclusion:'success'}));
  assert.equal(resolveNpmCompatibilityRecoveryMatrix({isRecovery:true,jobs,...identity}).reused,true);
  jobs[2].conclusion='cancelled';
  const result=resolveNpmCompatibilityRecoveryMatrix({isRecovery:true,jobs,...identity});
  const pending=groupNpmCompatibilityMatrix(result.include);
  assert.equal(pending.length,1);assert.equal(pending[0].platform,'darwin-arm64');assert.equal(pending[0].nodes.length,4);
  assert.equal(groupNpmCompatibilityMatrix([NPM_COMPATIBILITY_MATRIX[0]])[0].nodes.length,1);
  assert.equal(groupNpmCompatibilityMatrix([{node:'reused',platform:'reused',os:'ubuntu-22.04',reused:true}])[0].reused,true);
  const older=jobs.map(j=>({...j,name:j.name.replace(identity.targetVersion,'0.59.3')}));
  assert.equal(resolveNpmCompatibilityRecoveryMatrix({isRecovery:true,jobs:older,...identity}).include.length,16);
});
test('caller delegates to the same read-only qualification owner used for acceptance', () => {
  const caller=readFileSync(new URL('../../.github/workflows/release.yml',import.meta.url),'utf8');
  const qualify=readFileSync(new URL('../../.github/workflows/npm-install-compatibility.yml',import.meta.url),'utf8');
  assert.match(caller,/uses: \.\/\.github\/workflows\/npm-install-compatibility.yml/);
  assert.match(qualify,/ref: \$\{\{ github\.sha \}\}/);
  assert.match(qualify,/--expected-version "\$EXPECTED_VERSION"/);
  assert.match(qualify,/shell: bash/);
  for(const version of ['20.19.0','22.19.0','24','26']) assert.ok(qualify.includes(`node-version: "${version}"`));
  assert.equal((qualify.match(/Verify Node \d+ installation and SQLite/g)??[]).length,4);
});
