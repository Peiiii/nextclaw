#!/usr/bin/env node
/**
 * The release half of the portable-runtime acceptance contract.  It verifies
 * public facts before appending PRT-REL-001 to an already valid prepublish
 * candidate; it never synthesizes prepublish evidence or accepts a release
 * that merely has a successful workflow status.
 */
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT,
  PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT,
  type PortableRuntimeAcceptancePlatform,
} from "../../packages/nextclaw-kernel/src/types/portable-runtime-acceptance.types.js";
import {
  evaluatePortableRuntimeAcceptanceArtifact,
  parsePortableRuntimeAcceptanceEvidenceArtifact,
  type PortableRuntimeAcceptanceEvidenceArtifact,
} from "../../packages/nextclaw-kernel/src/utils/portable-runtime-acceptance-evaluator.utils.js";
import type { VerificationRecord } from "../../packages/nextclaw-kernel/src/types/verification-record.types.js";

const REPOSITORY = process.env.GITHUB_REPOSITORY ?? "Peiiii/nextclaw";
const PLATFORMS: readonly PortableRuntimeAcceptancePlatform[] = ["darwin-arm64", "windows-x64", "linux-x64"];

async function main(): Promise<void> {
  const input = required("--input");
  const output = required("--output");
  const version = required("--version");
  const desktopVersion = required("--desktop-version");
  assertStableVersion(version, "--version");
  assertStableVersion(desktopVersion, "--desktop-version");
  const candidate = parsePortableRuntimeAcceptanceEvidenceArtifact(JSON.parse(await readFile(resolve(input), "utf8")));
  assertPrepublishCandidate(candidate, version);
  const observations = await verifyPublicRelease({ version, desktopVersion });
  const withReleaseEvidence = appendReleaseEvidence(candidate, observations);
  assertPostpublishCandidate(withReleaseEvidence);
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(resolve(output), `${JSON.stringify(withReleaseEvidence, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ ok: true, kind: "nextclaw.portable-runtime.postpublish", checks: observations.checks }, null, 2)}\n`);
}

function assertPrepublishCandidate(artifact: PortableRuntimeAcceptanceEvidenceArtifact, version: string): void {
  if (artifact.contractFingerprint !== PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT) throw new Error("Prepublish evidence contract fingerprint is stale.");
  if (artifact.targets.length !== PLATFORMS.length || PLATFORMS.some((platform) => !artifact.targets.some((target) => target.environment === platform))) {
    throw new Error("Prepublish evidence does not cover the three canonical release platforms.");
  }
  const mismatched = artifact.targets.filter((target) => target.productVersion !== version || target.runtimeVersion !== version);
  if (mismatched.length > 0) throw new Error("Prepublish evidence version does not match the release version.");
  const results = evaluatePortableRuntimeAcceptanceArtifact(artifact);
  const open = PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT
    .filter((definition) => definition.required && definition.evidenceSource !== "release")
    .flatMap((definition) => definition.platforms.map((environment) => {
      const result = results.find((entry) => entry.acceptanceId === definition.id && entry.environment === environment);
      return result?.status === "current-passed" ? undefined : `${definition.id}@${environment}`;
    }))
    .filter((entry): entry is string => Boolean(entry));
  if (open.length > 0) throw new Error(`Cannot append release evidence while prepublish IDs are open: ${open.join(", ")}`);
}

async function verifyPublicRelease(params: { version: string; desktopVersion: string }): Promise<{
  checks: string[];
  refs: string[];
}> {
  const { version, desktopVersion } = params;
  const releaseTag = `nextclaw@${version}`;
  verifyNpmRelease(version);
  await verifyRuntimeReleaseAssets(releaseTag, version);
  const desktopRelease = await findStableDesktopRelease({ version, desktopVersion });
  const runtimeUrls = await verifyPublishedManifests(version, "npm-runtime-bundle", "npm-runtime-updates");
  const desktopUrls = await verifyPublishedManifests(version, undefined, "desktop-updates");
  const aptUrl = await verifyAptRelease(desktopVersion);
  const documentationUrls = await verifyDocumentationRelease(version);
  return {
    checks: ["npm-exact-and-latest", "runtime-release-assets", "runtime-manifests", "desktop-release-assets", "desktop-manifests", "apt", "docs"],
    refs: [
      `https://registry.npmjs.org/nextclaw/${version}`,
      `https://github.com/${REPOSITORY}/releases/tag/${releaseTag}`,
      `https://github.com/${REPOSITORY}/releases/tag/${desktopRelease.tagName}`,
      ...runtimeUrls, ...desktopUrls, aptUrl, ...documentationUrls,
    ],
  };
}

function verifyNpmRelease(version: string): void {
  const npmVersion = execFileSync("npm", ["view", `nextclaw@${version}`, "version"], { encoding: "utf8" }).trim();
  const npmLatest = execFileSync("npm", ["view", "nextclaw@latest", "version"], { encoding: "utf8" }).trim();
  if (npmVersion !== version || npmLatest !== version) {
    throw new Error(`NPM exact/latest check failed: exact=${npmVersion || "<missing>"}, latest=${npmLatest || "<missing>"}, expected=${version}.`);
  }
}

async function verifyRuntimeReleaseAssets(releaseTag: string, version: string): Promise<void> {
  const release = await githubJson(`/repos/${REPOSITORY}/releases/tags/${encodeURIComponent(releaseTag)}`) as {
    draft?: unknown; prerelease?: unknown; assets?: Array<{ name?: unknown; size?: unknown; state?: unknown }>;
  };
  if (release.draft === true || release.prerelease === true || !Array.isArray(release.assets)) throw new Error(`GitHub Release ${releaseTag} is not a public stable release.`);
  const assets = new Map(release.assets.map((asset) => [asset.name, asset]));
  for (const platform of ["darwin-arm64", "darwin-x64", "linux-x64", "win32-x64"]) {
    const name = `nextclaw-runtime-${platform}-${version}.zip`;
    const asset = assets.get(name);
    if (!asset || asset.state !== "uploaded" || typeof asset.size !== "number" || asset.size <= 0) throw new Error(`GitHub Runtime asset is missing or incomplete: ${name}.`);
  }
}

async function verifyPublishedManifests(
  version: string,
  hostKind: string | undefined,
  channel: "npm-runtime-updates" | "desktop-updates",
): Promise<string[]> {
  const runtimeTargets = [
    ["darwin", "arm64"], ["win32", "x64"], ["linux", "x64"],
  ] as const;
  const runtimeUrls = runtimeTargets.map(([platform, arch]) =>
    `https://peiiii.github.io/nextclaw/${channel}/stable/manifest-stable-${platform}-${arch}.json`);
  for (const url of runtimeUrls) {
    const manifest = await publicJson(url) as { latestVersion?: unknown; hostKind?: unknown };
    if (manifest.latestVersion !== version || (hostKind !== undefined && manifest.hostKind !== hostKind)) {
      throw new Error(`Public ${channel} manifest is stale or invalid: ${url}.`);
    }
  }
  return runtimeUrls;
}

async function verifyAptRelease(desktopVersion: string): Promise<string> {
  const aptUrl = "https://peiiii.github.io/nextclaw/apt/dists/stable/main/binary-amd64/Packages";
  const apt = await publicText(aptUrl);
  if (!apt.includes(`Version: ${desktopVersion}`)) throw new Error(`Public APT repository does not advertise Desktop ${desktopVersion}.`);
  return aptUrl;
}

async function verifyDocumentationRelease(version: string): Promise<string[]> {
  const releaseNotes = JSON.parse(await readFile(resolve(`apps/docs/public/release-notes/nextclaw-v${version}.json`), "utf8")) as {
    links?: { html?: Record<string, unknown> };
  };
  const documentationUrls = [releaseNotes.links?.html?.["zh-CN"], releaseNotes.links?.html?.["en-US"]];
  if (documentationUrls.some((url) => typeof url !== "string" || !url.startsWith("https://docs.nextclaw.io/"))) {
    throw new Error(`Release notes do not define public Chinese and English documentation URLs for ${version}.`);
  }
  for (const url of documentationUrls as string[]) await publicText(url);
  return documentationUrls as string[];
}

async function findStableDesktopRelease(params: { version: string; desktopVersion: string }): Promise<{
  tagName: string;
}> {
  const { version, desktopVersion } = params;
  const releases = await githubJson(`/repos/${REPOSITORY}/releases?per_page=100`) as Array<{
    tag_name?: unknown;
    draft?: unknown;
    prerelease?: unknown;
    assets?: Array<{ name?: unknown; size?: unknown; state?: unknown }>;
  }>;
  if (!Array.isArray(releases)) throw new Error("GitHub Desktop release listing is invalid.");
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tagPattern = new RegExp(`^v${escapedVersion}-desktop\\.\\d+$`);
  const candidates = releases.filter((release) =>
    typeof release.tag_name === "string" && tagPattern.test(release.tag_name) &&
    release.draft !== true && release.prerelease !== true,
  );
  if (candidates.length !== 1) {
    throw new Error(`Expected exactly one public stable Desktop release for runtime ${version}; found ${candidates.length}.`);
  }
  const release = candidates[0]!;
  const assets = new Map((release.assets ?? []).map((asset) => [asset.name, asset]));
  for (const name of [
    `NextClaw.Desktop-${desktopVersion}-arm64.dmg`,
    `NextClaw.Desktop-Setup-${desktopVersion}-x64.exe`,
    `NextClaw.Desktop-${desktopVersion}-linux-x64.AppImage`,
  ]) {
    const asset = assets.get(name);
    if (!asset || asset.state !== "uploaded" || typeof asset.size !== "number" || asset.size <= 0) {
      throw new Error(`GitHub Desktop asset is missing or incomplete: ${name}.`);
    }
  }
  return { tagName: release.tag_name as string };
}

function appendReleaseEvidence(
  candidate: PortableRuntimeAcceptanceEvidenceArtifact,
  observation: { checks: string[]; refs: string[] },
): PortableRuntimeAcceptanceEvidenceArtifact {
  const definition = PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT.find((entry) => entry.id === "PRT-REL-001");
  if (!definition) throw new Error("PRT-REL-001 is absent from the acceptance contract.");
  const now = new Date().toISOString();
  return {
    ...candidate,
    targets: candidate.targets.map((target) => {
      const record: VerificationRecord = {
        evidenceSchemaVersion: 2,
        evidenceSource: "release",
        verificationRunId: `release-${target.environment}-${randomUUID()}`,
        acceptanceId: definition.id,
        scenarioVersion: definition.scenarioVersion,
        productVersion: target.productVersion,
        runtimeVersion: target.runtimeVersion,
        implementationFingerprint: target.implementationFingerprint,
        status: "passed",
        startedAt: now,
        finishedAt: new Date().toISOString(),
        environment: target.environment,
        appId: target.appId,
        componentId: "portable-runtime-release",
        role: "system",
        entrySurface: "system",
        actionOrEvent: observation.checks.join(","),
        callId: `release-${target.environment}`,
        traceId: `release-${target.environment}-${definition.scenarioVersion}`,
        capabilityDecisions: observation.checks.map((check) => `release:${check}:passed`),
        inputDigest: digest(JSON.stringify(observation.refs)),
        outputDigest: digest(JSON.stringify(observation.checks)),
        dataVersion: `release-${definition.scenarioVersion}`,
        observation: { durationMs: 0, runnerPid: null, memory: null },
        evidenceRefs: observation.refs,
      };
      return {
        ...target,
        evidence: [
          ...target.evidence.filter((entry) => entry.source !== "release"),
          { source: "release" as const, records: [record] },
        ],
      };
    }),
  };
}

function assertPostpublishCandidate(artifact: PortableRuntimeAcceptanceEvidenceArtifact): void {
  const results = evaluatePortableRuntimeAcceptanceArtifact(artifact);
  const open = PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT
    .filter((definition) => definition.required)
    .flatMap((definition) => definition.platforms.map((environment) => {
      const result = results.find((entry) => entry.acceptanceId === definition.id && entry.environment === environment);
      return result?.status === "current-passed" ? undefined : `${definition.id}@${environment}`;
    }))
    .filter((entry): entry is string => Boolean(entry));
  if (open.length > 0) throw new Error(`Postpublish acceptance remains open: ${open.join(", ")}`);
}

async function githubJson(path: string): Promise<unknown> {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  const response = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: "application/vnd.github+json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!response.ok) throw new Error(`GitHub API ${path} returned ${response.status}.`);
  return await response.json();
}
async function publicJson(url: string): Promise<unknown> { return JSON.parse(await publicText(url)); }
async function publicText(url: string): Promise<string> {
  const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}portableAcceptance=${Date.now()}`);
  if (!response.ok) throw new Error(`Public URL returned ${response.status}: ${url}`);
  return await response.text();
}
function assertStableVersion(value: string, flag: string): void { if (!/^\d+\.\d+\.\d+$/.test(value)) throw new Error(`${flag} must be a stable semver.`); }
function required(name: string): string { const index = process.argv.indexOf(name); const value = index >= 0 ? process.argv[index + 1] : undefined; if (!value) throw new Error(`Missing ${name}.`); return value; }
function digest(value: string): string { return `sha256:${createHash("sha256").update(value).digest("hex")}`; }

void main().catch((error: unknown) => {
  console.error(`[portable-runtime-postpublish] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
