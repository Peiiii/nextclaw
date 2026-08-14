import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { analyzeRollouts, runCli } from "./report-task-phase-usage.mjs";

const workspace = "/workspace/nextclaw";

function usage(total) {
  const output = Math.max(1, Math.floor(total / 10));
  const input = total - output;
  return {
    input_tokens: input,
    cached_input_tokens: Math.floor(input / 2),
    cache_write_input_tokens: 0,
    output_tokens: output,
    reasoning_output_tokens: Math.floor(output / 2),
    total_tokens: total,
  };
}

function session(threadId, timestamp) {
  return {
    timestamp,
    type: "session_meta",
    payload: { id: threadId, cwd: workspace },
  };
}

function turn(timestamp, model = "gpt-5.6-sol", effort = "high") {
  return {
    timestamp,
    type: "turn_context",
    payload: { cwd: workspace, model, effort },
  };
}

function assistant(timestamp, firstLine) {
  return {
    timestamp,
    type: "response_item",
    payload: {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: `${firstLine}\nprogress` }],
    },
  };
}

function toolCall(timestamp) {
  return {
    timestamp,
    type: "response_item",
    payload: { type: "custom_tool_call", name: "exec" },
  };
}

function tokenCount(timestamp, total) {
  return {
    timestamp,
    type: "event_msg",
    payload: {
      type: "token_count",
      info: {
        total_token_usage: usage(total),
        last_token_usage: usage(total),
        model_context_window: 200000,
      },
    },
  };
}

async function withRollouts(files, run) {
  const directory = await mkdtemp(join(tmpdir(), "task-telemetry-"));
  try {
    const paths = [];
    for (const [name, records] of Object.entries(files)) {
      const path = join(directory, name);
      await writeFile(
        path,
        `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
      );
      paths.push(path);
    }
    return await run(paths);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function taskById(report, taskId) {
  const task = report.tasks.find((candidate) => candidate.id === taskId);
  assert.ok(task, `expected task ${taskId}`);
  return task;
}

function phaseByName(task, phase) {
  const result = task.phases.find((candidate) => candidate.phase === phase);
  assert.ok(result, `expected phase ${phase}`);
  return result;
}

test("attributes start, phase, end, model and tool rounds by response frame", async () => {
  const records = [
    session("thread-root", "2026-08-14T00:00:00.000Z"),
    turn("2026-08-14T00:00:00.010Z"),
    assistant(
      "2026-08-14T00:00:01.000Z",
      '[我严格遵守规则][nextclaw.dev/v1 task=start id=dt-aabbccdd name="优化任务统计名称" phase=implementation] start',
    ),
    toolCall("2026-08-14T00:00:01.100Z"),
    tokenCount("2026-08-14T00:00:02.000Z", 100),
    assistant(
      "2026-08-14T00:00:03.000Z",
      "[nextclaw.dev/v1 phase=validation] validate",
    ),
    tokenCount("2026-08-14T00:00:04.000Z", 170),
    assistant(
      "2026-08-14T00:00:05.000Z",
      "[nextclaw.dev/v1 task=end id=dt-aabbccdd status=completed] done",
    ),
    tokenCount("2026-08-14T00:00:06.000Z", 220),
  ];

  await withRollouts({ "root.jsonl": records }, async (paths) => {
    const report = await analyzeRollouts(paths);
    const task = taskById(report, "dt-aabbccdd");

    assert.equal(task.name, "优化任务统计名称");
    assert.equal(task.status, "completed");
    assert.equal(task.data_quality, "complete");
    assert.equal(task.started_at, "2026-08-14T00:00:02.000Z");
    assert.equal(task.ended_at, "2026-08-14T00:00:06.000Z");
    assert.equal(task.total_usage.total_tokens, 220);
    assert.equal(task.model_calls, 3);
    assert.equal(task.tool_call_rounds, 1);
    assert.equal(
      phaseByName(task, "implementation").total_usage.total_tokens,
      100,
    );
    assert.equal(phaseByName(task, "validation").total_usage.total_tokens, 120);
    assert.deepEqual(task.models, [
      {
        model: "gpt-5.6-sol",
        effort: "high",
        model_calls: 3,
        total_tokens: 220,
      },
    ]);
    assert.equal(task.mechanical_coverage, 1);
  });
});

test("keeps repeated and rework phases as idempotent spans", async () => {
  const records = [
    session("thread-rework", "2026-08-14T01:00:00.000Z"),
    turn("2026-08-14T01:00:00.010Z"),
    assistant(
      "2026-08-14T01:00:01.000Z",
      "[nextclaw.dev/v1 task=start id=dt-rework01 phase=implementation] start",
    ),
    tokenCount("2026-08-14T01:00:02.000Z", 40),
    assistant(
      "2026-08-14T01:00:03.000Z",
      "[nextclaw.dev/v1 phase=validation] validate",
    ),
    tokenCount("2026-08-14T01:00:04.000Z", 70),
    assistant(
      "2026-08-14T01:00:05.000Z",
      "[nextclaw.dev/v1 phase=implementation] rework",
    ),
    tokenCount("2026-08-14T01:00:06.000Z", 120),
    assistant(
      "2026-08-14T01:00:07.000Z",
      "[nextclaw.dev/v1 phase=implementation] duplicate",
    ),
    tokenCount("2026-08-14T01:00:08.000Z", 140),
    assistant(
      "2026-08-14T01:00:09.000Z",
      "[nextclaw.dev/v1 task=end id=dt-rework01 status=completed] done",
    ),
    tokenCount("2026-08-14T01:00:10.000Z", 160),
  ];

  await withRollouts({ "rework.jsonl": records }, async (paths) => {
    const task = taskById(await analyzeRollouts(paths), "dt-rework01");
    const implementation = phaseByName(task, "implementation");

    assert.equal(implementation.span_count, 2);
    assert.equal(implementation.total_usage.total_tokens, 130);
    assert.equal(phaseByName(task, "validation").total_usage.total_tokens, 30);
    assert.equal(task.warning_counts.duplicate_phase, 1);
  });
});

test("separates consecutive tasks and leaves inactive usage at corpus level", async () => {
  const records = [
    session("thread-two-tasks", "2026-08-14T02:00:00.000Z"),
    turn("2026-08-14T02:00:00.010Z"),
    assistant(
      "2026-08-14T02:00:01.000Z",
      "[nextclaw.dev/v1 task=start id=dt-first001 phase=design] start",
    ),
    tokenCount("2026-08-14T02:00:02.000Z", 20),
    assistant(
      "2026-08-14T02:00:03.000Z",
      "[nextclaw.dev/v1 task=end id=dt-first001 status=completed] done",
    ),
    tokenCount("2026-08-14T02:00:04.000Z", 40),
    assistant("2026-08-14T02:00:05.000Z", "ordinary untracked response"),
    tokenCount("2026-08-14T02:00:06.000Z", 60),
    assistant(
      "2026-08-14T02:00:07.000Z",
      "[nextclaw.dev/v1 task=start id=dt-second01 phase=implementation] start",
    ),
    tokenCount("2026-08-14T02:00:08.000Z", 90),
  ];

  await withRollouts({ "two-tasks.jsonl": records }, async (paths) => {
    const report = await analyzeRollouts(paths);
    const first = taskById(report, "dt-first001");
    const second = taskById(report, "dt-second01");

    assert.equal(first.total_usage.total_tokens, 40);
    assert.equal(first.status, "completed");
    assert.equal(second.total_usage.total_tokens, 30);
    assert.equal(second.status, "incomplete");
    assert.equal(second.data_quality, "partial");
    assert.equal(report.corpus.unattributed_usage.total_tokens, 20);
  });
});

test("joins child lanes independent of file order and aggregates mixed models", async () => {
  const root = [
    session("thread-root-child", "2026-08-14T03:00:00.000Z"),
    turn("2026-08-14T03:00:00.010Z"),
    assistant(
      "2026-08-14T03:00:01.000Z",
      "[nextclaw.dev/v1 task=start id=dt-child001 phase=implementation] start",
    ),
    tokenCount("2026-08-14T03:00:02.000Z", 100),
    assistant(
      "2026-08-14T03:00:09.000Z",
      "[nextclaw.dev/v1 task=end id=dt-child001 status=completed] done",
    ),
    tokenCount("2026-08-14T03:00:10.000Z", 160),
  ];
  const child = [
    session("thread-child", "2026-08-14T03:00:02.100Z"),
    turn("2026-08-14T03:00:02.200Z", "gpt-5.6-terra", "medium"),
    assistant(
      "2026-08-14T03:00:03.000Z",
      "[nextclaw.dev/v1 task=join id=dt-child001 phase=validation] join",
    ),
    tokenCount("2026-08-14T03:00:04.000Z", 50),
    assistant(
      "2026-08-14T03:00:05.000Z",
      "[nextclaw.dev/v1 phase=review] review",
    ),
    tokenCount("2026-08-14T03:00:06.000Z", 90),
    assistant(
      "2026-08-14T03:00:07.000Z",
      "[nextclaw.dev/v1 task=leave id=dt-child001 status=completed] leave",
    ),
    tokenCount("2026-08-14T03:00:08.000Z", 120),
  ];

  await withRollouts(
    { "00-child.jsonl": child, "99-root.jsonl": root },
    async (paths) => {
      const task = taskById(await analyzeRollouts(paths), "dt-child001");

      assert.equal(task.total_usage.total_tokens, 280);
      assert.equal(
        phaseByName(task, "implementation").total_usage.total_tokens,
        160,
      );
      assert.equal(
        phaseByName(task, "validation").total_usage.total_tokens,
        50,
      );
      assert.equal(phaseByName(task, "review").total_usage.total_tokens, 70);
      assert.equal(task.child_lane_count, 1);
      assert.equal(task.data_quality, "complete");
      assert.deepEqual(
        task.models.map(({ model, total_tokens }) => ({ model, total_tokens })),
        [
          { model: "gpt-5.6-sol", total_tokens: 160 },
          { model: "gpt-5.6-terra", total_tokens: 120 },
        ],
      );
    },
  );
});

test("fails closed on conflicting markers and recovers on a new start", async () => {
  const records = [
    session("thread-conflict", "2026-08-14T04:00:00.000Z"),
    turn("2026-08-14T04:00:00.010Z"),
    assistant(
      "2026-08-14T04:00:01.000Z",
      "[nextclaw.dev/v1 task=start id=dt-conflict phase=implementation] start",
    ),
    tokenCount("2026-08-14T04:00:02.000Z", 50),
    assistant(
      "2026-08-14T04:00:03.000Z",
      "[nextclaw.dev/v1 phase=validation][nextclaw.dev/v1 phase=review] conflict",
    ),
    tokenCount("2026-08-14T04:00:04.000Z", 80),
    assistant("2026-08-14T04:00:05.000Z", "still desynchronized"),
    tokenCount("2026-08-14T04:00:06.000Z", 100),
    assistant(
      "2026-08-14T04:00:07.000Z",
      "[nextclaw.dev/v1 task=start id=dt-conflict phase=implementation] recover",
    ),
    tokenCount("2026-08-14T04:00:08.000Z", 130),
    assistant(
      "2026-08-14T04:00:09.000Z",
      "[nextclaw.dev/v1 task=end id=dt-conflict status=completed] done",
    ),
    tokenCount("2026-08-14T04:00:10.000Z", 150),
  ];

  await withRollouts({ "conflict.jsonl": records }, async (paths) => {
    const report = await analyzeRollouts(paths);
    const task = taskById(report, "dt-conflict");

    assert.equal(task.total_usage.total_tokens, 100);
    assert.equal(task.unattributed_usage.total_tokens, 50);
    assert.equal(task.mechanical_coverage, 2 / 3);
    assert.equal(task.data_quality, "partial");
    assert.equal(task.warning_counts.multiple_markers, 1);
    assert.equal(task.reopen_count, 1);
  });
});

test("reports fragment usage gaps, counter resets and deterministic reruns", async () => {
  const records = [
    turn("2026-08-14T05:00:00.010Z"),
    assistant(
      "2026-08-14T05:00:01.000Z",
      "[nextclaw.dev/v1 task=start id=dt-fragment phase=task-understanding] start",
    ),
    tokenCount("2026-08-14T05:00:02.000Z", 100),
    assistant("2026-08-14T05:00:03.000Z", "continue"),
    tokenCount("2026-08-14T05:00:04.000Z", 130),
    assistant("2026-08-14T05:00:05.000Z", "counter reset"),
    tokenCount("2026-08-14T05:00:06.000Z", 20),
  ];

  await withRollouts({ "fragment.jsonl": records }, async (paths) => {
    const first = await analyzeRollouts(paths);
    const second = await analyzeRollouts(paths);
    const task = taskById(first, "dt-fragment");

    assert.deepEqual(second, first);
    assert.equal(task.total_usage.total_tokens, 50);
    assert.equal(task.status, "incomplete");
    assert.equal(task.data_quality, "partial");
    assert.equal(task.warning_counts.usage_unavailable, 1);
    assert.equal(task.warning_counts.counter_reset, 1);
  });
});

test("runs the public CLI path with rollout and JSON options", async () => {
  const records = [
    session("thread-cli", "2026-08-14T06:00:00.000Z"),
    turn("2026-08-14T06:00:00.010Z"),
    assistant(
      "2026-08-14T06:00:01.000Z",
      '[nextclaw.dev/v1 task=start id=dt-cli00001 name="验证 CLI 统计" phase=validation] start',
    ),
    tokenCount("2026-08-14T06:00:02.000Z", 25),
  ];

  await withRollouts({ "cli.jsonl": records }, async ([path]) => {
    const result = await runCli(["--rollout", path, "--format", "json"]);
    const report = JSON.parse(result.output);

    assert.equal(result.exitCode, 0);
    assert.equal(taskById(report, "dt-cli00001").total_usage.total_tokens, 25);

    const textResult = await runCli(["--rollout", path]);
    assert.match(textResult.output, /Task: 验证 CLI 统计/);
    assert.match(textResult.output, /Task ID: dt-cli00001/);
  });
});
