import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertDesktopReleaseAssetMetadata,
  assertDesktopReleaseAssetSet,
  buildDesktopReleaseObservation,
  buildExpectedDesktopReleaseAssetNames
} from "./desktop-release-closure.mjs";

const releaseOptions = {
  channel: "stable",
  desktopVersion: "0.0.266",
  runtimeVersion: "0.42.3",
  tag: "v0.42.3-desktop.5"
};

test("defines the complete five-platform desktop release asset set", () => {
  const assets = buildExpectedDesktopReleaseAssetNames(releaseOptions);
  assert.equal(assets.length, 30);
  assert.deepEqual(
    assets.filter((asset) => asset.startsWith("manifest-stable-")),
    [
      "manifest-stable-darwin-arm64.json",
      "manifest-stable-darwin-x64.json",
      "manifest-stable-linux-x64.json",
      "manifest-stable-win32-arm64.json",
      "manifest-stable-win32-x64.json"
    ]
  );
  assert.ok(assets.includes("NextClaw.Desktop-Setup-0.0.266-x64.exe"));
  assert.ok(assets.includes("NextClaw.Desktop-0.0.266-arm64.dmg"));
  assert.ok(assets.includes("NextClaw.Desktop-0.0.266-linux-x64.AppImage"));
  assert.ok(assets.includes("update-bundle-public.pem"));
});

test("uses the same complete contract for beta with beta manifests", () => {
  const assets = buildExpectedDesktopReleaseAssetNames({ ...releaseOptions, channel: "beta" });
  assert.equal(assets.length, 30);
  assert.ok(assets.includes("manifest-beta-win32-x64.json"));
  assert.ok(assets.includes("nextclaw-desktop_0.0.266_amd64.deb"));
});

test("rejects a release with a missing or stale asset", () => {
  const assets = buildExpectedDesktopReleaseAssetNames(releaseOptions);
  assert.throws(
    () => assertDesktopReleaseAssetSet(assets.slice(1), releaseOptions),
    /Missing: latest-mac-arm64\.yml/
  );
  assert.throws(
    () => assertDesktopReleaseAssetSet([...assets, "stale-installer.exe"], releaseOptions),
    /Unexpected: stale-installer\.exe/
  );
});

test("rejects an asset that is empty or not fully uploaded", () => {
  assert.throws(
    () =>
      assertDesktopReleaseAssetMetadata(
        [{ name: "installer.exe", size: 0, state: "uploaded" }],
        releaseOptions
      ),
    /installer\.exe:uploaded\/0/
  );
  assert.throws(
    () =>
      assertDesktopReleaseAssetMetadata(
        [{ name: "installer.exe", size: 100, state: "open" }],
        releaseOptions
      ),
    /installer\.exe:open\/100/
  );
});

test("builds structured workflow timing and process observations", () => {
  const observation = buildDesktopReleaseObservation({
    conclusion: "success",
    databaseId: 42,
    headSha: "abc123",
    jobs: [
      {
        completedAt: "2026-08-25T00:00:12Z",
        conclusion: "success",
        name: "desktop-win32-x64",
        startedAt: "2026-08-25T00:00:02Z",
        status: "completed",
        steps: [
          {
            completedAt: "2026-08-25T00:00:05Z",
            conclusion: "success",
            name: "Build",
            startedAt: "2026-08-25T00:00:02Z"
          },
          {
            completedAt: "2026-08-25T00:00:11Z",
            conclusion: "success",
            name: "Smoke",
            startedAt: "2026-08-25T00:00:05Z"
          }
        ]
      }
    ],
    status: "completed"
  });

  assert.equal(observation.schema, "nextclaw.desktop-release/v1");
  assert.equal(observation.runId, 42);
  assert.equal(observation.wallMs, 10_000);
  assert.equal(observation.jobs[0].durationMs, 10_000);
  assert.deepEqual(observation.jobs[0].slowestStep, {
    conclusion: "success",
    durationMs: 6_000,
    name: "Smoke"
  });
});

test("desktop publication is Draft-first and workflow-dispatched", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/desktop-release.yml", import.meta.url), "utf8");
  const releaseScript = readFileSync(new URL("./release-desktop.mjs", import.meta.url), "utf8");
  const githubRelease = readFileSync(new URL("./desktop-release-github.mjs", import.meta.url), "utf8");

  assert.doesNotMatch(workflow, /types:\s*\n\s*- published/);
  assert.doesNotMatch(workflow, /github\.event\.release|github\.event_name == 'release'/);
  assert.match(workflow, /require-draft-release:[\s\S]*?Require a hidden Draft before building/);
  assert.match(workflow, /build-desktop:[\s\S]*?needs: \[require-draft-release\]/);
  assert.match(workflow, /Refusing to upload assets because .* is already public/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /Verify complete Draft asset set[\s\S]*?expectedDraft: true/);
  assert.match(workflow, /publish-github-release:[\s\S]*?needs: \[publish-release-assets\]/);
  assert.match(workflow, /gh release edit[\s\S]*?--draft=false/);
  assert.match(
    workflow,
    /publish-desktop-update-channels:[\s\S]*?needs: \[build-desktop, publish-release-assets, publish-github-release\]/
  );

  assert.match(githubRelease, /"--draft"/);
  assert.match(githubRelease, /"workflow",\s*\n\s*"run"/);
  assert.match(githubRelease, /"--ref",\s*\n\s*tag/);
  assert.doesNotMatch(githubRelease, /"--ref",\s*\n\s*branch/);
  assert.match(githubRelease, /`dispatch_id=\$\{workflowDispatchId\}`/);
  assert.match(workflow, /run-name: desktop-release .* dispatch=\$\{\{ inputs\.dispatch_id \}\}/);
  assert.match(
    releaseScript,
    /createDraftRelease\(options\)[\s\S]*?dispatchReleaseWorkflow\(options\)[\s\S]*?waitForDesktopReleaseClosure\(\{ \.\.\.options, \.\.\.workflowDispatch \}\)/
  );
  assert.doesNotMatch(releaseScript, /runRemoteValidation|validationWorkflow|skipRemoteValidation/);
  assert.match(
    releaseScript,
    /runRemotePreflight\(options\)[\s\S]*?createDraftRelease\(options\)[\s\S]*?dispatchReleaseWorkflow\(options\)/
  );
  assert.match(
    workflow,
    /build-desktop:[\s\S]*?Build Desktop \(macOS\)[\s\S]*?Smoke Desktop Install \(macOS DMG\)[\s\S]*?Upload desktop artifacts \(macOS\)/
  );
  assert.match(
    workflow,
    /build-desktop:[\s\S]*?Build Desktop \(Windows\)[\s\S]*?Smoke Desktop \(Windows\)[\s\S]*?Upload desktop artifacts \(Windows\)/
  );
  assert.match(
    workflow,
    /build-desktop:[\s\S]*?Build Desktop \(Linux\)[\s\S]*?Smoke Desktop \(Linux AppImage\)[\s\S]*?Upload desktop artifacts \(Linux\)/
  );
});
