#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPluginOverrideValue,
  inspectProductionBuildStatus,
  pluginHasBuildScript,
  pluginSupportsDevelopmentSource,
  readPluginOverrideMetadata,
  resolveFirstPartyPluginRef,
} from "./dev-plugin-overrides-support.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "../..");
const devRunnerPath = resolve(rootDir, "scripts/dev/dev-runner.mjs");
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function fail(message) {
  console.error(`[dev:start:plugins] ${message}`);
  process.exit(1);
}

function printHelp() {
  console.log(`Usage: pnpm dev:start:plugins -- --plugin <ref> [options]

Options:
  --plugin <ref>          First-party plugin ref. Supports unique plugin id, dir name, or path.
  --development           Use #development for every selected plugin.
  --production            Use production dist for every selected plugin (default).
  --build-if-needed       Rebuild stale production plugins before start (default).
  --no-build-if-needed    Fail fast instead of rebuilding stale production plugins.
  --dry-run               Print the resolved launch plan without starting dev processes.
  --json                  When used with --dry-run, print machine-readable JSON.
  --help                  Show this help.
`);
}

export function parseDevStartPluginsArgs(argv) {
  const options = {
    pluginRefs: [],
    source: "production",
    buildIfNeeded: true,
    dryRun: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--") {
      continue;
    }
    switch (arg) {
      case "--plugin":
        if (!next) {
          throw new Error("--plugin requires a value.");
        }
        options.pluginRefs.push(next);
        index += 1;
        break;
      case "--development":
        options.source = "development";
        break;
      case "--production":
        options.source = "production";
        break;
      case "--build-if-needed":
        options.buildIfNeeded = true;
        break;
      case "--no-build-if-needed":
        options.buildIfNeeded = false;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.pluginRefs.length === 0) {
    throw new Error("At least one --plugin is required.");
  }

  return options;
}

export function buildPlan(options) {
  const seenPluginIds = new Set();
  const plugins = options.pluginRefs.map((pluginRef) => {
    const resolvedPlugin = resolveFirstPartyPluginRef(rootDir, pluginRef);
    if (seenPluginIds.has(resolvedPlugin.pluginId)) {
      throw new Error(`Duplicate plugin selection for "${resolvedPlugin.pluginId}".`);
    }
    seenPluginIds.add(resolvedPlugin.pluginId);

    const metadata = readPluginOverrideMetadata(resolvedPlugin.pluginPath);
    if (options.source === "development" && !pluginSupportsDevelopmentSource(resolvedPlugin.pluginPath)) {
      throw new Error(
        `Plugin "${resolvedPlugin.pluginId}" does not expose development source. Use production mode instead.`,
      );
    }

    const productionBuildStatus =
      options.source === "production"
        ? inspectProductionBuildStatus(resolvedPlugin.pluginPath)
        : {
            stale: false,
            reason: null,
          };
    const shouldBuild =
      options.source === "production" &&
      productionBuildStatus.stale &&
      options.buildIfNeeded;
    if (
      options.source === "production" &&
      productionBuildStatus.stale &&
      !options.buildIfNeeded
    ) {
      throw new Error(
        `Plugin "${resolvedPlugin.pluginId}" has a stale production build. ` +
          `Run \`pnpm -C ${resolvedPlugin.pluginPath} build\`, re-run with --build-if-needed, or use --development.`,
      );
    }
    if (shouldBuild && !pluginHasBuildScript(resolvedPlugin.pluginPath)) {
      throw new Error(
        `Plugin "${resolvedPlugin.pluginId}" needs a rebuild but has no build script. Use --development instead.`,
      );
    }

    return {
      pluginRef,
      pluginId: resolvedPlugin.pluginId,
      pluginPath: resolvedPlugin.pluginPath,
      dirName: resolvedPlugin.dirName,
      packageName: metadata.packageName,
      source: options.source,
      shouldBuild,
      productionBuildStatus,
    };
  });

  const devRunnerArgs = [
    devRunnerPath,
    "start",
    ...plugins.flatMap((entry) => [
      "--plugin-override",
      createPluginOverrideValue({
        pluginId: entry.pluginId,
        pluginPath: entry.pluginPath,
        source: entry.source,
      }),
    ]),
  ];

  return {
    source: options.source,
    buildIfNeeded: options.buildIfNeeded,
    plugins,
    devRunnerArgs,
  };
}

function runCommand(args, label) {
  const result = spawnSync(process.execPath, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status === 0) {
    return;
  }
  if (typeof result.status === "number") {
    process.exit(result.status);
  }
  fail(`${label} terminated unexpectedly.`);
}

function printHumanPlan(plan) {
  for (const plugin of plan.plugins) {
    console.log(
      `[dev:start:plugins] ${plugin.pluginId} -> ${plugin.pluginPath} (${plugin.source})`,
    );
    if (plugin.shouldBuild) {
      console.log(
        `[dev:start:plugins] rebuilding stale production dist for ${plugin.pluginId} before launch...`,
      );
    }
  }
}

function main() {
  let options;
  try {
    options = parseDevStartPluginsArgs(process.argv.slice(2));
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  let plan;
  try {
    plan = buildPlan(options);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  if (options.dryRun) {
    if (options.json) {
      console.log(JSON.stringify(plan, null, 2));
      return;
    }
    printHumanPlan(plan);
    console.log(
      `[dev:start:plugins] dry-run command: ${process.execPath} ${plan.devRunnerArgs.join(" ")}`,
    );
    return;
  }

  printHumanPlan(plan);
  for (const plugin of plan.plugins) {
    if (!plugin.shouldBuild) {
      continue;
    }
    const buildResult = spawnSync(pnpmCommand, ["-C", plugin.pluginPath, "build"], {
      cwd: rootDir,
      stdio: "inherit",
      env: process.env,
      shell: pnpmCommand.endsWith(".cmd"),
    });
    if (buildResult.status !== 0) {
      process.exit(buildResult.status ?? 1);
    }
  }

  runCommand(plan.devRunnerArgs, "dev start");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
