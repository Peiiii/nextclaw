import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStableCompletionSummary,
  buildStableDryRunPlan,
  buildStableNpmTimingSummary,
  buildStablePublishedInstallArgs,
  buildStablePublishedUpgradeArgs,
  buildStableReleaseTags,
  buildStableRuntimeCommandArgs,
  formatStableRecoveryCommand,
  inspectStableSurfaceReview,
  parseStableReleaseArgs,
  resolveReleaseNpmUserconfig,
  resolveNpmTimingStatus,
  resolveStableReleaseLevel,
  resolveStableReleasePlan,
  resolveStablePublishedPreviousVersion,
  validateStableResumeOptions,
} from "./release-stable.utils.mjs";
import { validateReusableReleaseBuilds } from "./ensure-pnpm-publish.mjs";

test("parses the default full stable closure", () => {
  assert.deepEqual(parseStableReleaseArgs([]), {
    artifactOutput: null,
    branch: "master",
    dryRun: false,
    help: false,
    maxPublishSeconds: 60,
    minimumLauncherVersionOverride: null,
    previousVersion: null,
    prepareOnly: false,
    publishConcurrency: 12,
    requireProductArtifacts: false,
    releaseTag: null,
    resumeFrom: "packages",
    skipPublishedInstall: false,
    skipRuntimeChannel: false,
    targetBranch: "master",
    trustedPublishing: false,
    verifyConcurrency: 8,
    version: null,
  });
});

test("parses prepared publish performance controls", () => {
  const options = parseStableReleaseArgs([
    "--prepare-only",
    "--target-branch",
    "stable",
    "--publish-concurrency",
    "16",
    "--verify-concurrency",
    "6",
    "--max-publish-seconds",
    "55",
  ]);
  assert.equal(options.prepareOnly, true);
  assert.equal(options.targetBranch, "stable");
  assert.equal(options.publishConcurrency, 16);
  assert.equal(options.verifyConcurrency, 6);
  assert.equal(options.maxPublishSeconds, 55);
});

test("enables GitHub Actions trusted publishing only through an explicit flag", () => {
  assert.equal(
    parseStableReleaseArgs(["--trusted-publishing"]).trustedPublishing,
    true,
  );
  assert.equal(parseStableReleaseArgs([]).trustedPublishing, false);
});

test("allows artifact export only during preparation", () => {
  const options = parseStableReleaseArgs([
    "--prepare-only",
    "--artifact-output",
    "/tmp/npm-prepared",
  ]);
  assert.equal(options.artifactOutput, "/tmp/npm-prepared");
  assert.throws(
    () => parseStableReleaseArgs(["--artifact-output", "/tmp/npm-prepared"]),
    /requires --prepare-only/,
  );
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
    "--require-product-artifacts",
    "--branch",
    "release/stable",
  ]);
  assert.equal(options.resumeFrom, "runtime");
  assert.equal(options.version, "0.30.0");
  assert.equal(options.previousVersion, "0.29.0");
  assert.equal(options.skipPublishedInstall, true);
  assert.equal(options.requireProductArtifacts, true);
  assert.equal(options.branch, "release/stable");
});

test("rejects unknown recovery stages", () => {
  assert.throws(
    () => parseStableReleaseArgs(["--resume-from", "publish-again"]),
    /Unsupported --resume-from stage/,
  );
});

test("requires an exact version for recovery", () => {
  assert.throws(
    () =>
      validateStableResumeOptions(
        parseStableReleaseArgs(["--resume-from", "runtime"]),
      ),
    /requires --version/,
  );
  assert.throws(
    () =>
      validateStableResumeOptions(
        parseStableReleaseArgs([
          "--resume-from",
          "runtime",
          "--version",
          "0.30.0",
        ]),
      ),
    /requires --previous-version/,
  );
  assert.doesNotThrow(() =>
    validateStableResumeOptions(
      parseStableReleaseArgs([
        "--resume-from",
        "runtime",
        "--version",
        "0.30.0",
        "--skip-published-install",
      ]),
    ),
  );
});

test("resolves nextclaw versions from the changeset release plan", () => {
  assert.deepEqual(
    resolveStableReleasePlan({
      preState: null,
      releases: [
        {
          name: "@nextclaw/shared",
          oldVersion: "0.4.19",
          newVersion: "0.4.20",
        },
        { name: "nextclaw", oldVersion: "0.29.0", newVersion: "0.30.0" },
      ],
    }),
    { packageCount: 2, previousVersion: "0.29.0", targetVersion: "0.30.0" },
  );
  assert.throws(
    () => resolveStableReleasePlan({ preState: { mode: "pre" }, releases: [] }),
    /pre mode is active/,
  );
});

test("resolves the public previous version when promoting a beta to stable", () => {
  assert.equal(
    resolveStablePublishedPreviousVersion({
      plannedPreviousVersion: "0.42.2",
      publishedStableVersion: "0.42.2",
      targetVersion: "0.42.3",
    }),
    "0.42.2",
  );
  assert.equal(
    resolveStablePublishedPreviousVersion({
      plannedPreviousVersion: "0.42.3-beta.0",
      publishedStableVersion: "0.42.2",
      targetVersion: "0.42.3",
    }),
    "0.42.2",
  );
});

test("rejects unrelated prerelease and registry drift", () => {
  assert.throws(
    () =>
      resolveStablePublishedPreviousVersion({
        plannedPreviousVersion: "0.42.4-beta.0",
        publishedStableVersion: "0.42.2",
        targetVersion: "0.42.5",
      }),
    /Changesets expects nextclaw 0\.42\.4-beta\.0/,
  );
  assert.throws(
    () =>
      resolveStablePublishedPreviousVersion({
        plannedPreviousVersion: "0.42.1",
        publishedStableVersion: "0.42.2",
        targetVersion: "0.42.3",
      }),
    /npm latest is 0\.42\.2/,
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
      targetVersion: "0.30.1",
    }),
    { issues: [], ready: true, releaseLevel: "patch", required: false },
  );

  const missing = inspectStableSurfaceReview({
    pathExists: () => false,
    previousVersion: "0.30.0",
    review: null,
    targetVersion: "0.31.0",
  });
  assert.equal(missing.required, true);
  assert.equal(missing.ready, false);
  assert.match(missing.issues.join("\n"), /release review is missing/);
});

test("accepts audited docs and website decisions for a minor release", () => {
  const existingPaths = new Set([
    "apps/docs/guide.md",
    "apps/landing/src/main.ts",
    "images/screenshots/release.png",
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
          text: "NextClaw v0.31.0 is out. https://docs.nextclaw.io/en/notes/v0-31-0",
        },
      },
    },
    targetVersion: "0.31.0",
  });
  assert.deepEqual(result, {
    issues: [],
    ready: true,
    releaseLevel: "minor",
    required: true,
  });

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
          text: "NextClaw v0.31.0 is out. https://docs.nextclaw.io/en/notes/v0-31-0",
        },
      },
    },
    targetVersion: "0.31.0",
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
        website: { decision: "updated", paths: ["apps/landing/src/main.ts"] },
      },
    },
    targetVersion: "0.31.0",
  });
  assert.equal(missingSocialPost.ready, false);
  assert.match(
    missingSocialPost.issues.join("\n"),
    /social post decision must be publish/,
  );
});

test("resolves the effective project npm config before any auth conclusion", () => {
  const existingPaths = new Set(["/repo/.npmrc"]);
  const pathExists = (filePath) => existingPaths.has(filePath);
  assert.equal(
    resolveReleaseNpmUserconfig({
      commonGitDir: "/repo/.git",
      configuredUserconfig: null,
      currentWorktree: "/tmp/release",
      pathExists,
    }),
    "/repo/.npmrc",
  );
  assert.equal(
    resolveReleaseNpmUserconfig({
      commonGitDir: "/repo/.git",
      configuredUserconfig: "/custom/.npmrc",
      currentWorktree: "/tmp/release",
      pathExists,
    }),
    "/custom/.npmrc",
  );
  existingPaths.add("/tmp/release/.npmrc");
  assert.equal(
    resolveReleaseNpmUserconfig({
      commonGitDir: "/repo/.git",
      configuredUserconfig: null,
      currentWorktree: "/tmp/release",
      pathExists,
    }),
    "/tmp/release/.npmrc",
  );
  assert.throws(
    () =>
      resolveReleaseNpmUserconfig({
        commonGitDir: "/repo/.git",
        configuredUserconfig: null,
        currentWorktree: "/repo",
        pathExists: () => false,
        required: true,
      }),
    /refusing ambient ~\/.npmrc/,
  );
});

test("dry run exposes every closure stage and explicit exceptions", () => {
  const plan = buildStableDryRunPlan({
    branch: "master",
    npmPublishPackageCount: 22,
    packageCount: 29,
    previousVersion: "0.29.0",
    releaseNotesReady: true,
    surfaceReviewReady: true,
    surfaceReviewRequired: true,
    resumeFrom: "packages",
    skipPublishedInstall: false,
    skipRuntimeChannel: false,
    targetVersion: "0.30.0",
    targetBranch: "master",
    validationPackageCount: 39,
    validationSupportPackageCount: 17,
    worktreeClean: true,
  });
  assert.match(plan.join("\n"), /prepared tarball proof/);
  assert.match(plan.join("\n"), /release commit/);
  assert.match(plan.join("\n"), /public manifests/);
  assert.match(plan.join("\n"), /check\/download\/apply\/new process/);
  assert.match(plan.join("\n"), /npm publish packages: 22/);
  assert.match(plan.join("\n"), /validation closure: 39/);
  assert.match(plan.join("\n"), /desktop: excluded/);

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
    worktreeClean: false,
  });
  assert.equal(skipped.at(-3), "- stable runtime channel: skipped");
  assert.equal(skipped.at(-2), "- published install: skipped");
  assert.equal(skipped.at(-1), "- desktop: excluded");
});

test("reports content pending without blocking the product core release", () => {
  const plan = buildStableDryRunPlan({
    branch: "master",
    npmPublishPackageCount: 10,
    packageCount: 12,
    previousVersion: "0.45.5",
    releaseNotesReady: false,
    surfaceReviewReady: false,
    surfaceReviewRequired: true,
    resumeFrom: "packages",
    skipPublishedInstall: false,
    skipRuntimeChannel: false,
    targetVersion: "0.46.0",
    validationPackageCount: 38,
    validationSupportPackageCount: 28,
    worktreeClean: true,
  }).join("\n");

  assert.match(
    plan,
    /CONTENT_PENDING \(runtime uses deterministic GitHub Release fallback\)/,
  );
  assert.match(
    plan,
    /CONTENT_PENDING \(does not block NPM or Runtime core closure\)/,
  );
  assert.doesNotMatch(plan, /blocks runtime|blocks product closure/);
});

test("formats an unambiguous recovery command", () => {
  const command = formatStableRecoveryCommand("runtime", {
    branch: "master",
    previousVersion: "0.29.0",
    skipPublishedInstall: false,
    skipRuntimeChannel: false,
    version: "0.30.0",
  });
  assert.equal(
    command,
    "pnpm release:stable -- --resume-from runtime --version 0.30.0 --previous-version 0.29.0",
  );
});

test("builds deterministic runtime, install, and package tag commands", () => {
  const options = {
    minimumLauncherVersionOverride: null,
    releaseTag: null,
    skipPublishedInstall: false,
    skipRuntimeChannel: false,
  };
  assert.deepEqual(buildStableRuntimeCommandArgs("master", "0.30.0", options), [
    "release:stable:runtime",
    "--",
    "--branch",
    "master",
    "--version",
    "0.30.0",
  ]);
  assert.deepEqual(
    buildStablePublishedInstallArgs("0.30.0", "0.29.0", options),
    [
      "-C",
      "packages/nextclaw",
      "validation:npm-update",
      "--",
      "--published-stable",
      "--expected-version",
      "0.30.0",
      "--previous-version",
      "0.29.0",
      "--package-only",
    ],
  );
  assert.deepEqual(
    buildStablePublishedUpgradeArgs("0.30.0", "0.29.0", options),
    [
      "-C",
      "packages/nextclaw",
      "validation:npm-update",
      "--",
      "--published-stable",
      "--expected-version",
      "0.30.0",
      "--previous-version",
      "0.29.0",
      "--update-only",
    ],
  );
  assert.deepEqual(
    buildStableReleaseTags({
      packages: {
        nextclaw: { version: "0.30.0" },
        "@nextclaw/kernel": { version: "0.7.0" },
      },
    }),
    ["@nextclaw/kernel@0.7.0", "nextclaw@0.30.0"],
  );
});

test("reports the NPM_READY completion point explicitly", () => {
  assert.deepEqual(
    buildStableNpmTimingSummary({
      checkpoint: { packages: { nextclaw: {}, "@nextclaw/core": {} } },
      publishSummary: { attemptsUsed: 1, publishedCount: 2, reusedCount: 0 },
      targetVersion: "0.30.0",
    }).slice(0, 6),
    [
      "NPM_READY",
      "- channel: stable/latest",
      "- package count: 2",
      "- tarballs uploaded now: 2",
      "- versions already visible: 0",
      "- nextclaw version: 0.30.0",
    ],
  );
});

test("observes the NPM_READY wall-clock target without invalidating success", () => {
  assert.equal(resolveNpmTimingStatus(59_999, 60), "met (<60s)");
  assert.equal(resolveNpmTimingStatus(60_000, 60), "missed (target <60s)");
});

test("reports the same phase timings when the NPM timing target is missed", () => {
  const summary = buildStableNpmTimingSummary({
    checkpoint: { packages: { nextclaw: {} } },
    durationMs: 120_970,
    phaseTimings: {
      artifactResolutionMs: 10_000,
      packagePhaseMs: 80_000,
      postPublishClosureMs: 30_970,
    },
    publishSummary: {
      attemptsUsed: 4,
      publishedCount: 22,
      reusedCount: 0,
      timings: { precheckMs: 2_000, uploadMs: 60_000, verifyMs: 18_000 },
    },
    timingStatus: "missed (target <60s)",
    targetVersion: "0.38.0",
  }).join("\n");

  assert.match(summary, /^NPM_READY/m);
  assert.match(summary, /time budget: missed \(target <60s\)/);
  assert.match(
    summary,
    /timing: artifact 10\.00s, package phase 80\.00s, Git\/install join 30\.97s/,
  );
  assert.match(
    summary,
    /package timing: precheck 2\.00s, upload 60\.00s, verify 18\.00s/,
  );
  assert.match(summary, /publish duration: 120\.97s/);
});

test("does not claim product-ready before docs, website, and X owner closure", () => {
  const summary = buildStableCompletionSummary({
    branch: "master",
    checkpoint: { packages: { nextclaw: {} } },
    releaseCommit: "abc123",
    releaseTags: ["nextclaw@0.30.0"],
    skipPublishedInstall: false,
    skipRuntimeChannel: false,
    targetVersion: "0.30.0",
  });
  assert.equal(summary[0], "release:product:stable core stages completed");
  assert.match(summary.join("\n"), /NEXTCLAW_STABLE_READY: pending/);
});

test("only ignores publish lifecycle scripts backed by the release checkpoint", () => {
  const checkpoint = {
    packages: {
      "@nextclaw/core": {
        packageDir: "packages/nextclaw-core",
        steps: { build: { status: "passed" } },
      },
    },
  };
  assert.deepEqual(
    validateReusableReleaseBuilds(checkpoint, () => ({
      name: "@nextclaw/core",
      scripts: {
        prepack: "pnpm run build",
        prepublishOnly: "node ../../scripts/release/ensure-pnpm-publish.mjs",
      },
    })),
    [],
  );
  assert.match(
    validateReusableReleaseBuilds(checkpoint, () => ({
      name: "@nextclaw/core",
      scripts: { prepack: "node generate-release-file.mjs" },
    })).join("\n"),
    /cannot reuse build while ignoring prepack/,
  );
});
