import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { parseOptions } from "./serve-task-telemetry-dashboard.mjs";
import {
  discoverProjectRollouts,
  listenForTaskTelemetryDashboard,
} from "./lib/task-telemetry-dashboard-server.mjs";

function usage(total) {
  return {
    input_tokens: total - 10,
    cached_input_tokens: Math.floor(total / 2),
    cache_write_input_tokens: 0,
    output_tokens: 10,
    reasoning_output_tokens: 4,
    total_tokens: total,
  };
}

function rollout(workspace, threadId, taskId, taskName = "Dashboard test") {
  return [
    {
      timestamp: "2026-08-15T00:00:00.000Z",
      type: "session_meta",
      payload: { id: threadId, cwd: workspace },
    },
    {
      timestamp: "2026-08-15T00:00:00.010Z",
      type: "turn_context",
      payload: { cwd: workspace, model: "gpt-test", effort: "low" },
    },
    {
      timestamp: "2026-08-15T00:00:01.000Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: `[nextclaw.dev/v1 task=start id=${taskId} name="${taskName}" phase=implementation] start`,
          },
        ],
      },
    },
    {
      timestamp: "2026-08-15T00:00:02.000Z",
      type: "event_msg",
      payload: { type: "token_count", info: { total_token_usage: usage(100) } },
    },
    {
      timestamp: "2026-08-15T00:00:03.000Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: `[nextclaw.dev/v1 task=end id=${taskId} status=completed] done`,
          },
        ],
      },
    },
    {
      timestamp: "2026-08-15T00:00:04.000Z",
      type: "event_msg",
      payload: { type: "token_count", info: { total_token_usage: usage(140) } },
    },
  ];
}

async function writeRollout(path, records, date = ["2026", "08", "15"]) {
  await mkdir(join(path, ...date), { recursive: true });
  const target = join(path, ...date, `${records[0].payload.id}.jsonl`);
  await writeFile(
    target,
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
  );
  return target;
}

test("parses quick-start dashboard options", () => {
  const options = parseOptions([
    "--no-open",
    "--port",
    "4888",
    "--sessions-root",
    "/sessions",
    "--since",
    "2026-08-14",
    "--workspace",
    "/workspace",
  ]);
  assert.equal(options.open, false);
  assert.equal(options.port, 4888);
  assert.equal(options.sessionsRoot, "/sessions");
  assert.equal(options.historyStart, "2026-08-14");
  assert.equal(options.workspace, "/workspace");
});

test("filters rollouts to the current project workspace", async () => {
  const directory = await mkdtemp(join(tmpdir(), "task-dashboard-discovery-"));
  try {
    const sessionsRoot = join(directory, "sessions");
    const workspace = join(directory, "workspace");
    await mkdir(workspace, { recursive: true });
    const selected = await writeRollout(
      sessionsRoot,
      rollout(workspace, "thread-selected", "dt-select01"),
    );
    await writeRollout(
      sessionsRoot,
      rollout(join(directory, "other"), "thread-other", "dt-other001"),
    );
    await writeRollout(
      sessionsRoot,
      rollout(workspace, "thread-old", "dt-old0001"),
      ["2026", "08", "13"],
    );

    const result = await discoverProjectRollouts({ sessionsRoot, workspace });
    assert.equal(result.scanned_rollout_count, 3);
    assert.equal(result.eligible_rollout_count, 2);
    assert.equal(result.matched_rollout_count, 1);
    assert.deepEqual(result.paths, [selected]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("serves a cached project report and static dashboard", async () => {
  const directory = await mkdtemp(join(tmpdir(), "task-dashboard-server-"));
  let server = null;
  try {
    const sessionsRoot = join(directory, "sessions");
    const workspace = join(directory, "workspace");
    await mkdir(workspace, { recursive: true });
    await writeRollout(
      sessionsRoot,
      rollout(workspace, "thread-dashboard", "dt-board001"),
    );
    const running = await listenForTaskTelemetryDashboard({
      port: 0,
      sessionsRoot,
      workspace,
    });
    server = running.server;

    const health = await fetch(`${running.url}/api/health`).then((response) =>
      response.json(),
    );
    assert.equal(health.kind, "nextclaw-development-task-telemetry-dashboard");
    assert.equal(health.history_start, "2026-08-14");
    assert.equal(health.sessions_root, sessionsRoot);

    const first = await fetch(`${running.url}/api/report`).then((response) =>
      response.json(),
    );
    assert.equal(first.meta.cache_hit, false);
    assert.equal(first.meta.history_start, "2026-08-14");
    assert.equal(first.meta.matched_rollout_count, 1);
    assert.equal(first.meta.parsed_rollout_count, 1);
    assert.equal(first.report.tasks[0].id, "dt-board001");
    assert.equal(first.report.tasks[0].name, "Dashboard test");
    assert.equal(first.report.tasks[0].started_at, "2026-08-15T00:00:02.000Z");
    assert.equal(first.report.tasks[0].total_usage.total_tokens, 140);

    const second = await fetch(`${running.url}/api/report`).then((response) =>
      response.json(),
    );
    assert.equal(second.meta.cache_hit, true);

    const page = await fetch(running.url);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /^text\/html/);
    assert.match(await page.text(), /Development Task Telemetry/);
  } finally {
    if (server)
      await new Promise((resolvePromise) => server.close(resolvePromise));
    await rm(directory, { recursive: true, force: true });
  }
});
