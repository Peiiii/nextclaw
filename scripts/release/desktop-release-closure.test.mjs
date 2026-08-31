import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertDesktopReleaseAssetMetadata,
  assertDesktopReleaseAssetSet,
  buildDesktopReleaseObservation,
  buildExpectedDesktopReleaseAssetNames,
  waitForPublicManifest
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

test("allows the APT-specific Pages package after the core release closes", () => {
  const assets = buildExpectedDesktopReleaseAssetNames(releaseOptions);
  assert.deepEqual(
    assertDesktopReleaseAssetSet(
      [...assets, `nextclaw-desktop_${releaseOptions.desktopVersion}_amd64.pages.deb`],
      releaseOptions
    ),
    assets
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

test("public manifest propagation treats read failures and stale versions as pending", async () => {
  const observations = [new Error("curl 404"), { latestVersion: "0.42.2" }, {
    latestVersion: "0.42.3",
    minimumLauncherVersion: "0.0.260",
    releaseNotesUrl: "https://example.test/notes"
  }];
  let reads = 0;
  let sleeps = 0;
  await waitForPublicManifest({
    ...releaseOptions,
    minimumLauncherVersion: "0.0.260",
    publicAttempts: 3,
    publicDelayMs: 1,
    readJsonCommand: async () => {
      const observation = observations[reads++];
      if (observation instanceof Error) throw observation;
      return observation;
    },
    releaseNotesUrl: "https://example.test/notes",
    sleep: async () => { sleeps += 1; }
  });
  assert.equal(reads, 3);
  assert.equal(sleeps, 2);
});

test("public manifest fails immediately after expected version exposes an immutable-field mismatch", async () => {
  let reads = 0;
  await assert.rejects(
    waitForPublicManifest({
      ...releaseOptions,
      minimumLauncherVersion: "0.0.260",
      publicAttempts: 3,
      publicDelayMs: 1,
      readJsonCommand: async () => {
        reads += 1;
        return {
          latestVersion: "0.42.3",
          minimumLauncherVersion: "0.0.259",
          releaseNotesUrl: "https://example.test/notes"
        };
      },
      releaseNotesUrl: "https://example.test/notes",
      sleep: async () => {}
    }),
    /minimumLauncherVersion mismatch/
  );
  assert.equal(reads, 1);
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
  assert.match(releaseScript, /--prepare-draft-only/);
  assert.match(releaseScript, /inferExistingDesktopDraft/);
  assert.match(
    workflow,
    /publish-desktop-update-channels:[\s\S]*?needs: \[build-desktop, publish-release-assets, publish-github-release\]/
  );

  assert.match(githubRelease, /"--draft"/);
  assert.match(githubRelease, /"workflow",\s*\n\s*"run"/);
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
    /Build Desktop Installer \(Windows\)[\s\S]*?electron-builder --win nsis --x64 --prepackaged release\/win-unpacked --publish never/
  );
  assert.doesNotMatch(workflow, /(?:pnpm|npm) rebuild better-sqlite3/);
  assert.doesNotMatch(
    workflow,
    /publish-desktop-update-channels:[\s\S]*?fetch-depth: 0[\s\S]*?publish-linux-apt-repo:[\s\S]*?fetch-depth: 0/
  );
  assert.equal(workflow.match(/git fetch --depth=1 origin gh-pages/g)?.length, 2);
  assert.match(
    workflow,
    /build-desktop:[\s\S]*?Build Desktop \(Linux\)[\s\S]*?Smoke Desktop \(Linux AppImage\)[\s\S]*?Upload desktop artifacts \(Linux\)/
  );
});

test("desktop owner infers APT recovery without public recovery inputs", () => {
  const releaseScript = readFileSync(new URL("./release-desktop.mjs", import.meta.url), "utf8");
  const githubRelease = readFileSync(new URL("./desktop-release-github.mjs", import.meta.url), "utf8");
  const recovery = readFileSync(new URL("./desktop-release-recovery.mjs", import.meta.url), "utf8");
  assert.match(githubRelease, /publish_linux_apt_only=\$\{publishLinuxAptOnly === true\}/);
  assert.match(
    releaseScript,
    /inferExistingReleaseRecovery\(options, run\) \?\? inferExistingDesktopDraft\(options, run\)[\s\S]*?options\.tag \?\?= readNextDesktopReleaseTag/,
  );
  assert.match(recovery, /publishLinuxAptOnly: true/);
});

test("desktop Draft dispatch carries an immutable target before the tag exists", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/desktop-release.yml", import.meta.url), "utf8");
  const closure = readFileSync(new URL("./desktop-release-closure.mjs", import.meta.url), "utf8");
  const githubRelease = readFileSync(new URL("./desktop-release-github.mjs", import.meta.url), "utf8");

  assert.match(githubRelease, /"--ref",\s*\n\s*branch/);
  assert.doesNotMatch(githubRelease, /"--ref",\s*\n\s*tag/);
  assert.match(githubRelease, /`release_target=\$\{target\}`/);
  assert.match(githubRelease, /`node_version=\$\{nodeVersion\}`/);
  assert.equal(
    workflow.match(/node-version: \$\{\{ inputs\.node_version \}\}/g)?.length,
    2,
  );
  assert.match(githubRelease, /release\.targetCommitish !== target/);
  assert.match(workflow, /release_target:[\s\S]*?Immutable commit SHA/);
  assert.match(workflow, /Draft target must equal immutable release_target/);
  assert.match(workflow, /ref: \$\{\{ inputs\.release_target \|\| inputs\.release_tag \}\}/);
  assert.match(
    workflow,
    /Apply release bundle budget compatibility[\s\S]*?const compatibleBudget = "const RUNTIME_BUNDLE_FILE_BUDGET = 520;";[\s\S]*?source\.replace/
  );
  assert.match(workflow, /\(\?:400\|450\)/);
  assert.match(
    closure,
    /const \{ tag, target \} = options;[\s\S]*?waitForWorkflowRun\(options\)[\s\S]*?waitForWorkflowSuccess\(options, runEntry\)[\s\S]*?readTagSha\(tag\)[\s\S]*?tagSha !== target/
  );
});

test("desktop closure reads one raw gh-pages manifest without fetching the repository", () => {
  const closure = readFileSync(new URL("./desktop-release-closure.mjs", import.meta.url), "utf8");

  assert.match(
    closure,
    /https:\/\/raw\.githubusercontent\.com\/\$\{repo\}\/gh-pages\/desktop-updates\/\$\{channel\}/,
  );
  assert.match(
    closure,
    /https:\/\/raw\.githubusercontent\.com\/\$\{repo\}\/gh-pages\/apt\/dists\/stable\/main\/binary-amd64\/Packages/,
  );
  assert.doesNotMatch(closure, /fetchGhPagesWithRetry|"fetch",\s*"origin"/);
  assert.doesNotMatch(closure, /origin\/gh-pages:/);
});

test("Windows portable smoke emits renderer evidence and defers only recoverable cleanup locks", () => {
  const smoke = readFileSync(
    new URL("../../apps/desktop/scripts/smoke-windows-desktop.ps1", import.meta.url),
    "utf8"
  );
  const portableVerify = readFileSync(new URL("../desktop/desktop-portable-verify.mjs", import.meta.url), "utf8");

  assert.equal(smoke.match(/NEXTCLAW_DESKTOP_SMOKE_TITLEBAR_HIT_TEST = "1"/g)?.length, 1);
  assert.match(
    smoke,
    /if \(\$isPortableSmoke\)[\s\S]*?} else \{[\s\S]*?\$env:NEXTCLAW_DESKTOP_DATA_DIR_OVERRIDE = \$smokeHome\s*}\s*\$env:NEXTCLAW_DESKTOP_SMOKE_TITLEBAR_HIT_TEST = "1"/
  );
  assert.match(portableVerify, /maxRetries: 10, retryDelay: 500/);
  assert.match(portableVerify, /\["EBUSY", "ENOTEMPTY", "EPERM"\]\.includes\(code\)/);
  assert.match(portableVerify, /temporary cleanup deferred to the runner/);
  assert.match(portableVerify, /if \(!\["EBUSY", "ENOTEMPTY", "EPERM"\]\.includes\(code\)\) \{\s*throw error;/);
});
