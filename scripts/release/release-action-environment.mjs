import { appendFileSync } from "node:fs";

const MINIMUM_NODE_VERSION = "22.14.0";
const MINIMUM_NPM_VERSION = "11.5.1";

function parseNumericVersion(version, label) {
  const match = String(version ?? "").trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`Could not parse ${label} version: ${version ?? "<missing>"}`);
  }
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function assertMinimumVersion(actual, minimum, label) {
  if (
    compareVersions(
      parseNumericVersion(actual, label),
      parseNumericVersion(minimum, `${label} minimum`),
    ) < 0
  ) {
    throw new Error(
      `NPM trusted publishing requires ${label} ${minimum} or newer; current ${actual}.`,
    );
  }
}

export function assertTrustedPublishingEnvironment(options) {
  const { env = process.env, nodeVersion, npmVersion } = options;
  if (env.GITHUB_ACTIONS !== "true") {
    throw new Error(
      "NPM trusted publishing is restricted to GitHub Actions runners.",
    );
  }
  if (
    !env.ACTIONS_ID_TOKEN_REQUEST_URL?.trim() ||
    !env.ACTIONS_ID_TOKEN_REQUEST_TOKEN?.trim()
  ) {
    throw new Error(
      "GitHub OIDC is unavailable. Grant the publish job `id-token: write`.",
    );
  }
  assertMinimumVersion(nodeVersion, MINIMUM_NODE_VERSION, "Node");
  assertMinimumVersion(npmVersion, MINIMUM_NPM_VERSION, "npm");
}

export function writeReleaseActionOutputs(values, outputPath) {
  if (!outputPath?.trim()) return false;
  const lines = Object.entries(values).map(([key, value]) => {
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid GitHub Actions output key: ${key}`);
    }
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value);
    if (serialized.includes("\n") || serialized.includes("\r")) {
      throw new Error(`GitHub Actions output ${key} must be single-line.`);
    }
    return `${key}=${serialized}`;
  });
  appendFileSync(outputPath, `${lines.join("\n")}\n`);
  return true;
}

export function buildStableReleaseActionOutputs({
  contentReady,
  context,
  gitSummary,
}) {
  return {
    closure_commit: gitSummary.closureCommit,
    content_ready: contentReady,
    has_nextclaw: Boolean(context.targetVersion),
    previous_version: context.previousVersion ?? "",
    release_commit: gitSummary.releaseCommit,
    release_tags_json: gitSummary.releaseTags,
    target_version: context.targetVersion ?? "",
  };
}

export const TRUSTED_PUBLISHING_MINIMUMS = Object.freeze({
  node: MINIMUM_NODE_VERSION,
  npm: MINIMUM_NPM_VERSION,
});
