import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readLatestReleaseCheckpoint } from "./release-checkpoints.mjs";

const IGNORED_PUBLISH_LIFECYCLE_HOOKS = [
  "prepublish",
  "prepublishOnly",
  "prepack",
  "prepare",
  "postpack",
  "publish",
  "postpublish"
];
const ARTIFACT_VERIFIER = "verify-package-release-artifacts.mjs";

export function validateReusableReleaseBuilds(checkpoint, readPackageJson) {
  const issues = [];
  const releasePackages = Object.entries(checkpoint?.packages ?? {});
  if (releasePackages.length === 0) {
    issues.push("release checkpoint has no publish packages");
  }

  for (const [packageName, packageState] of releasePackages) {
    const pkg = readPackageJson(packageState.packageDir);
    if (pkg?.name !== packageName) {
      issues.push(`${packageName}: checkpoint package identity does not match package.json`);
      continue;
    }
    const lifecycleScripts = Object.fromEntries(
      IGNORED_PUBLISH_LIFECYCLE_HOOKS.flatMap((hook) =>
        typeof pkg.scripts?.[hook] === "string" ? [[hook, pkg.scripts[hook]]] : []
      )
    );
    const unsupportedHooks = Object.entries(lifecycleScripts).filter(([hook, command]) => {
      if (hook === "prepack") {
        return command !== "pnpm run build" && !command.includes(ARTIFACT_VERIFIER);
      }
      if (hook === "prepublishOnly") {
        return !command.includes("ensure-pnpm-publish.mjs");
      }
      return true;
    });
    for (const [hook, command] of unsupportedHooks) {
      issues.push(`${packageName}: cannot reuse build while ignoring ${hook}=${command}`);
    }
    if (
      lifecycleScripts.prepack === "pnpm run build" &&
      packageState.steps?.build?.status !== "passed"
    ) {
      issues.push(`${packageName}: prepack build has no passed release-check checkpoint`);
    }
    if (
      lifecycleScripts.prepack?.includes(ARTIFACT_VERIFIER) &&
      !["@nextclaw/ui", "nextclaw"].includes(packageName)
    ) {
      issues.push(`${packageName}: artifact verifier is not covered by publish-artifact preparation`);
    }
  }

  return issues;
}

function assertReusableReleaseBuilds() {
  const checkpointRecord = readLatestReleaseCheckpoint();
  if (!checkpointRecord) {
    throw new Error("validated publish requires a release-check checkpoint");
  }
  const issues = validateReusableReleaseBuilds(
    checkpointRecord.checkpoint,
    (packageDir) => JSON.parse(readFileSync(resolve(packageDir, "package.json"), "utf8"))
  );
  if (issues.length > 0) {
    throw new Error(`validated publish cannot ignore package lifecycle scripts:\n${issues.join("\n")}`);
  }
  console.log(
    `[release:publish] reusing validated builds for ${Object.keys(checkpointRecord.checkpoint.packages).length} package(s)`
  );
}

function assertPnpmPublish() {
  const userAgent = process.env.npm_config_user_agent ?? "";
  const packageName = process.env.npm_package_name ?? "this package";
  if (userAgent.includes("pnpm/")) {
    return;
  }
  throw new Error(
    [
      `Refusing to publish ${packageName} with npm.`,
      "This workspace uses workspace:* internal dependencies.",
      "Direct npm publish keeps workspace:* in the registry manifest and breaks installs.",
      "Use pnpm publish or the repo-root release flow: pnpm release:publish."
    ].join("\n")
  );
}

function main() {
  if (process.argv.includes("--validated-release-batch")) {
    assertReusableReleaseBuilds();
    return;
  }
  assertPnpmPublish();
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
