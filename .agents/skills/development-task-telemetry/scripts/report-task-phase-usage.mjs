#!/usr/bin/env node

import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { analyzeRollouts } from "./lib/task-phase-analyzer.mjs";
import { USAGE_KEYS } from "./lib/task-phase-protocol.mjs";

export { analyzeRollouts };

function percent(value) {
  return value === null ? "unavailable" : `${(value * 100).toFixed(2)}%`;
}

function formatUsage(usage) {
  return USAGE_KEYS.map((key) => `  ${key}: ${usage[key]}`).join("\n");
}

export function formatTextReport(report, taskId = null) {
  const selectedTasks = taskId
    ? report.tasks.filter((task) => task.id === taskId)
    : report.tasks;
  if (taskId && selectedTasks.length === 0)
    throw new Error(`Task not found: ${taskId}`);

  const lines = [
    `Protocol: ${report.protocol}`,
    `Corpus mechanical coverage: ${percent(report.corpus.mechanical_coverage)}`,
    "Corpus observed usage:",
    formatUsage(report.corpus.observed_usage),
  ];

  if (selectedTasks.length === 0) lines.push("", "No tracked tasks found.");
  for (const task of selectedTasks) {
    lines.push(
      "",
      `Task: ${task.name ?? "Unnamed task"}`,
      `Task ID: ${task.id}`,
      `Status: ${task.status}`,
      `Data quality: ${task.data_quality}`,
      `Mechanical coverage: ${percent(task.mechanical_coverage)}`,
      `Model calls: ${task.model_calls}`,
      `Tool-call rounds: ${task.tool_call_rounds}`,
      `Elapsed ms: ${task.task_elapsed_ms ?? "unavailable"}`,
      "Total usage:",
      formatUsage(task.total_usage),
      "By phase:",
    );
    for (const phase of task.phases) {
      lines.push(
        `  ${phase.phase}: spans=${phase.span_count} total_tokens=${phase.total_usage.total_tokens} share=${percent(phase.share_of_task_tokens)}`,
      );
    }
    lines.push("Models:");
    for (const model of task.models) {
      lines.push(
        `  ${model.model}/${model.effort}: calls=${model.model_calls} total_tokens=${model.total_tokens}`,
      );
    }
    const warnings = Object.entries(task.warning_counts);
    if (warnings.length > 0) {
      lines.push("Warnings:");
      for (const [code, count] of warnings) lines.push(`  ${code}: ${count}`);
    }
  }

  return lines.join("\n");
}

async function collectJsonlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...(await collectJsonlFiles(path)));
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) paths.push(path);
  }
  return paths;
}

function parseCliArguments(argv) {
  const options = {
    rollouts: [],
    sessionsRoot: null,
    threadIds: [],
    taskId: null,
    format: "text",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const readValue = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--"))
        throw new Error(`Missing value for ${argument}`);
      index += 1;
      return value;
    };

    if (argument === "--rollout") options.rollouts.push(readValue());
    else if (argument === "--sessions-root") options.sessionsRoot = readValue();
    else if (argument === "--thread") options.threadIds.push(readValue());
    else if (argument === "--task") options.taskId = readValue();
    else if (argument === "--format") options.format = readValue();
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }

  if (!new Set(["text", "json"]).has(options.format)) {
    throw new Error(`Unsupported format: ${options.format}`);
  }
  return options;
}

function helpText() {
  return `Usage:
  report-task-phase-usage.mjs --rollout <path> [--rollout <path>...] [--task <task-id>] [--format text|json]
  report-task-phase-usage.mjs --sessions-root <path> [--thread <thread-id>...] [--task <task-id>] [--format text|json]

Options:
  --rollout <path>       Read one rollout JSONL file; repeat for child threads.
  --sessions-root <path> Recursively discover rollout JSONL files.
  --thread <id>          With --sessions-root, keep files whose names contain this thread id.
  --task <task-id>       Show one task. JSON output still retains corpus facts.
  --format <text|json>   Output format. Default: text.
  --help                 Show this help.

Default Codex sessions root:
  ${join(homedir(), ".codex", "sessions")}`;
}

export async function runCli(argv) {
  const options = parseCliArguments(argv);
  if (options.help) return { output: helpText(), exitCode: 0 };

  let rolloutPaths = options.rollouts.map((path) => resolve(path));
  if (options.sessionsRoot) {
    const discovered = await collectJsonlFiles(resolve(options.sessionsRoot));
    rolloutPaths.push(
      ...discovered.filter(
        (path) =>
          options.threadIds.length === 0 ||
          options.threadIds.some((threadId) =>
            basename(path).includes(threadId),
          ),
      ),
    );
  }
  rolloutPaths = [...new Set(rolloutPaths)].sort();
  if (rolloutPaths.length === 0) {
    throw new Error(
      "No rollout files selected. Use --rollout or --sessions-root.",
    );
  }

  const report = await analyzeRollouts(rolloutPaths);
  if (options.format === "json") {
    const output = options.taskId
      ? {
          ...report,
          tasks: report.tasks.filter((task) => task.id === options.taskId),
        }
      : report;
    if (options.taskId && output.tasks.length === 0) {
      throw new Error(`Task not found: ${options.taskId}`);
    }
    return { output: JSON.stringify(output, null, 2), exitCode: 0 };
  }
  return { output: formatTextReport(report, options.taskId), exitCode: 0 };
}

const isMain =
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  runCli(process.argv.slice(2))
    .then(({ output, exitCode }) => {
      process.stdout.write(`${output}\n`);
      process.exitCode = exitCode;
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
