import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStableDryRunPlan,
  buildStablePublishedInstallArgs,
  buildStableReleaseTags,
  buildStableRuntimeCommandArgs,
  formatStableRecoveryCommand,
  inspectStableSurfaceReview,
  parseStableReleaseArgs,
  resolveLinkedWorktreeNpmUserconfig,
  resolveStableReleaseLevel,
  resolveStableReleasePlan,
  validateStableResumeOptions
} from "./release-stable.utils.mjs";

test("parses the default full stable closure", () => {
  assert.deepEqual(parseStableReleaseArgs([]), {
    branch: "master",
    dryRun: false,
    help: false,
    minimumLauncherVersionOverride: null,
    previousVersion: null,
    releaseTag: null,
    resumeFrom: "packages",
    skipPublishedInstall: false,
    skipRuntimeChannel: false,
    version: null
  });
});

test("parses explicit recovery and exception flags", () => {
  const options = parseStableReleaseArgs([
    "--resume-from",
    "runtime",
    "--version",
    "0.30.0",
    "--previous-version",
    "0.29.0",
    "--skip-published-install",
    "--branch",
    "release/stable"
  ]);
  assert.equal(options.resumeFrom, "runtime");
  assert.equal(options.version, "0.30.0");
  assert.equal(options.previousVersion, "0.29.0");
  assert.equal(options.skipPublishedInstall, true);
  assert.equal(options.branch, "release/stable");
});

test("rejects unknown recovery stages", () => {
  assert.throws(
    () => parseStableReleaseArgs(["--resume-from", "publish-again"]),
    /Unsupported --resume-from stage/
  );
});

test("requires an exact version for recovery", () => {
  assert.throws(
    () => validateStableResumeOptions(parseStableReleaseArgs(["--resume-from", "runtime"])),
    /requires --version/
  );
  assert.throws(
    () =>
      validateStableResumeOptions(
        parseStableReleaseArgs(["--resume-from", "runtime", "--version", "0.30.0"])
      ),
    /requires --previous-version/
  );
  assert.doesNotThrow(() =>
    validateStableResumeOptions(
      parseStableReleaseArgs([
        "--resume-from",
        "runtime",
        "--version",
        "0.30.0",
        "--skip-published-install"
      ])
    )
  );
});

test("resolves nextclaw versions from the changeset release plan", () => {
  assert.deepEqual(
    resolveStableReleasePlan({
      preState: null,
      releases: [
        { name: "@nextclaw/shared", oldVersion: "0.4.19", newVersion: "0.4.20" },
        { name: "nextclaw", oldVersion: "0.29.0", newVersion: "0.30.0" }
      ]
    }),
    { packageCount: 2, previousVersion: "0.29.0", targetVersion: "0.30.0" }
  );
  assert.throws(
    () => resolveStableReleasePlan({ preState: { mode: "pre" }, releases: [] }),
    /pre mode is active/
  );
});

test("classifies stable release levels and requires surface review for minor or major", () => {
  assert.equal(resolveStableReleaseLevel("0.30.0", "0.30.1"), "patch");
  assert.equal(resolveStableReleaseLevel("0.30.1", "0.31.0"), "minor");
  assert.equal(resolveStableReleaseLevel("0.31.0", "1.0.0"), "major");

  assert.deepEqual(
    inspectStableSurfaceReview({
      pathExists: () => false,
      previousVersion: "0.30.0",
      review: null,
      targetVersion: "0.30.1"
    }),
    { issues: [], ready: true, releaseLevel: "patch", required: false }
  );

  const missing = inspectStableSurfaceReview({
    pathExists: () => false,
    previousVersion: "0.30.0",
    review: null,
    targetVersion: "0.31.0"
  });
  assert.equal(missing.required, true);
  assert.equal(missing.ready, false);
  assert.match(missing.issues.join("\n"), /release review is missing/);
});

test("accepts audited docs and website decisions for a minor release", () => {
  const existingPaths = new Set([
    "apps/docs/guide.md",
    "apps/landing/src/main.ts",
    "images/screenshots/release.png"
  ]);
  const result = inspectStableSurfaceReview({
    pathExists: (path) => existingPaths.has(path),
    previousVersion: "0.30.0",
    review: {
      version: "0.31.0",
      releaseType: "minor",
      surfaces: {
        docsSite: { decision: "updated", paths: ["apps/docs/guide.md"] },
        website: { decision: "updated", paths: ["apps/landing/src/main.ts"] },
        socialPost: {
          account: "@nextclaw",
          channel: "x",
          decision: "publish",
          imageAlt: "Release screenshot",
          imagePath: "images/screenshots/release.png",
          releaseNotesUrl: "https://docs.nextclaw.io/en/notes/v0-31-0",
          text: "NextClaw v0.31.0 is out. https://docs.nextclaw.io/en/notes/v0-31-0"
        }
      }
    },
    targetVersion: "0.31.0"
  });
  assert.deepEqual(result, { issues: [], ready: true, releaseLevel: "minor", required: true });

  const missingReason = inspectStableSurfaceReview({
    pathExists: () => true,
    previousVersion: "0.30.0",
    review: {
      version: "0.31.0",
      releaseType: "minor",
      surfaces: {
        docsSite: { decision: "updated", paths: ["apps/docs/guide.md"] },
        website: { decision: "not-needed" },
        socialPost: {
          account: "@nextclaw",
          channel: "x",
          decision: "publish",
          imageAlt: "Release screenshot",
          imagePath: "images/screenshots/release.png",
          releaseNotesUrl: "https://docs.nextclaw.io/en/notes/v0-31-0",
          text: "NextClaw v0.31.0 is out. https://docs.nextclaw.io/en/notes/v0-31-0"
        }
      }
    },
    targetVersion: "0.31.0"
  });
  assert.equal(missingReason.ready, false);
  assert.match(missingReason.issues.join("\n"), /requires a reason/);

  const missingSocialPost = inspectStableSurfaceReview({
    pathExists: () => true,
    previousVersion: "0.30.0",
    review: {
      version: "0.31.0",
      releaseType: "minor",
      surfaces: {
        docsSite: { decision: "updated", paths: ["apps/docs/guide.md"] },
        website: { decision: "updated", paths: ["apps/landing/src/main.ts"] }
      }
    },
    targetVersion: "0.31.0"
  });
  assert.equal(missingSocialPost.ready, false);
  assert.match(missingSocialPost.issues.join("\n"), /social post decision must be publish/);
});

test("inherits a primary worktree npm config only when the linked worktree has none", () => {
  const existingPaths = new Set(["/repo/.npmrc"]);
  const pathExists = (filePath) => existingPaths.has(filePath);
  assert.equal(
    resolveLinkedWorktreeNpmUserconfig({
      commonGitDir: "/repo/.git",
      configuredUserconfig: null,
      currentWorktree: "/tmp/release",
      pathExists
    }),
    "/repo/.npmrc"
  );
  assert.equal(
    resolveLinkedWorktreeNpmUserconfig({
      commonGitDir: "/repo/.git",
      configuredUserconfig: "/custom/.npmrc",
      currentWorktree: "/tmp/release",
      pathExists
    }),
    null
  );
  existingPaths.add("/tmp/release/.npmrc");
  assert.equal(
    resolveLinkedWorktreeNpmUserconfig({
      commonGitDir: "/repo/.git",
      configuredUserconfig: null,
      currentWorktree: "/tmp/release",
      pathExists
    }),
    null
  );
});

test("dry run exposes every closure stage and explicit exceptions", () => {
  const plan = buildStableDryRunPlan({
    branch: "master",
    packageCount: 29,
    previousVersion: "0.29.0",
    releaseNotesReady: true,
    surfaceReviewReady: true,
    surfaceReviewRequired: true,
    resumeFrom: "packages",
    skipPublishedInstall: false,
    skipRuntimeChannel: false,
    targetVersion: "0.30.0",
    worktreeClean: true
  });
  assert.match(plan.join("\n"), /strict check/);
  assert.match(plan.join("\n"), /release commit/);
  assert.match(plan.join("\n"), /public manifests/);
  assert.match(plan.join("\n"), /check\/download\/apply\/new process/);

  const skipped = buildStableDryRunPlan({
    branch: "master",
    packageCount: 2,
    previousVersion: "0.29.0",
    releaseNotesReady: false,
    surfaceReviewReady: true,
    surfaceReviewRequired: false,
    resumeFrom: "packages",
    skipPublishedInstall: true,
    skipRuntimeChannel: true,
    targetVersion: "0.29.1",
    worktreeClean: false
  });
  assert.equal(skipped.at(-2), "- stable runtime channel: skipped");
  assert.equal(skipped.at(-1), "- published install: skipped");
});

test("formats an unambiguous recovery command", () => {
  const command = formatStableRecoveryCommand("runtime", {
    branch: "master",
    previousVersion: "0.29.0",
    skipPublishedInstall: false,
    skipRuntimeChannel: false,
    version: "0.30.0"
  });
  assert.equal(
    command,
    "pnpm release:stable -- --resume-from runtime --version 0.30.0 --previous-version 0.29.0"
  );
});

test("builds deterministic runtime, install, and package tag commands", () => {
  const options = {
    minimumLauncherVersionOverride: null,
    releaseTag: null,
    skipPublishedInstall: false,
    skipRuntimeChannel: false
  };
  assert.deepEqual(buildStableRuntimeCommandArgs("master", "0.30.0", options), [
    "release:stable:runtime",
    "--",
    "--branch",
    "master",
    "--version",
    "0.30.0"
  ]);
  assert.deepEqual(buildStablePublishedInstallArgs("0.30.0", "0.29.0", options), [
    "-C",
    "packages/nextclaw",
    "validation:npm-update",
    "--",
    "--published-stable",
    "--expected-version",
    "0.30.0",
    "--previous-version",
    "0.29.0"
  ]);
  assert.deepEqual(
    buildStableReleaseTags({
      packages: {
        nextclaw: { version: "0.30.0" },
        "@nextclaw/kernel": { version: "0.7.0" }
      }
    }),
    ["@nextclaw/kernel@0.7.0", "nextclaw@0.30.0"]
  );
});
