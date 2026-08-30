import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  assertTrustedPublishingEnvironment,
  buildStableReleaseActionOutputs,
  writeReleaseActionOutputs,
} from "./release-action-environment.mjs";

const oidcEnv = {
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: "request-token",
  ACTIONS_ID_TOKEN_REQUEST_URL: "https://token.actions.githubusercontent.com",
  GITHUB_ACTIONS: "true",
};

function assertPortableRuntimeBuildContract() {
  const runtimeWorkflow = readFileSync(
    new URL("../../.github/workflows/npm-runtime-update-release.yml", import.meta.url),
    "utf8",
  );
  assert.match(runtimeWorkflow, /Build Portable Service App runtime/);
  assert.match(
    runtimeWorkflow,
    /build-product-runtime\.mjs --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\}/,
  );
}

test("accepts the minimum trusted publishing runtime", () => {
  assert.doesNotThrow(() =>
    assertTrustedPublishingEnvironment({
      env: oidcEnv,
      nodeVersion: "22.14.0",
      npmVersion: "11.5.1",
    }),
  );
});

test("rejects trusted publishing outside GitHub Actions", () => {
  assert.throws(
    () =>
      assertTrustedPublishingEnvironment({
        env: {},
        nodeVersion: "22.14.0",
        npmVersion: "11.5.1",
      }),
    /restricted to GitHub Actions/,
  );
});

test("rejects missing OIDC permission and outdated clients", () => {
  assert.throws(
    () =>
      assertTrustedPublishingEnvironment({
        env: { GITHUB_ACTIONS: "true" },
        nodeVersion: "22.14.0",
        npmVersion: "11.5.1",
      }),
    /id-token: write/,
  );
  assert.throws(
    () =>
      assertTrustedPublishingEnvironment({
        env: oidcEnv,
        nodeVersion: "22.13.1",
        npmVersion: "11.5.1",
      }),
    /Node 22.14.0 or newer/,
  );
  assert.throws(
    () =>
      assertTrustedPublishingEnvironment({
        env: oidcEnv,
        nodeVersion: "22.14.0",
        npmVersion: "11.4.9",
      }),
    /npm 11.5.1 or newer/,
  );
});

test("writes single-line GitHub Actions outputs", () => {
  const directory = mkdtempSync(join(tmpdir(), "release-action-output-"));
  const outputPath = join(directory, "github-output");
  assert.equal(
    writeReleaseActionOutputs(
      {
        content_ready: false,
        release_tags_json: ["nextclaw@1.2.3"],
        target_version: "1.2.3",
      },
      outputPath,
    ),
    true,
  );
  assert.equal(
    readFileSync(outputPath, "utf8"),
    'content_ready=false\nrelease_tags_json=["nextclaw@1.2.3"]\ntarget_version=1.2.3\n',
  );
  assert.throws(
    () =>
      writeReleaseActionOutputs(
        { target_version: "1.2.3\nunsafe" },
        outputPath,
      ),
    /single-line/,
  );
});

test("builds stable release outputs from the closed release state", () => {
  assert.deepEqual(
    buildStableReleaseActionOutputs({
      contentReady: true,
      context: { previousVersion: "0.42.2", targetVersion: "0.42.3" },
      gitSummary: {
        closureCommit: "closure",
        releaseCommit: "release",
        releaseTags: ["nextclaw-v0.42.3"],
      },
    }),
    {
      closure_commit: "closure",
      content_ready: true,
      has_nextclaw: true,
      previous_version: "0.42.2",
      release_commit: "release",
      release_tags_json: ["nextclaw-v0.42.3"],
      target_version: "0.42.3",
    },
  );
});

test("release workflow isolates token publishing and serializes stable runs", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/release.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /^permissions: \{\}$/m);
  assert.match(
    workflow,
    /group: nextclaw-stable-release\n {2}cancel-in-progress: false/,
  );
  assert.match(workflow, /environment: npm-production/);
  assert.match(workflow, /NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_TOKEN \}\}/);
  assert.match(workflow, /pnpm release:npm:stable -- "\$\{args\[@\]\}"/);
  assert.match(workflow, /GITHUB_REF.*refs\/heads\/master/);
  assert.doesNotMatch(workflow, /id-token: write|--trusted-publishing/);
  assert.doesNotMatch(workflow, /OPENAI_API_KEY|ANTHROPIC_API_KEY/);
});

test("one all-platform dispatch closes NPM, Runtime, and Desktop inside GitHub Actions", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/release.yml", import.meta.url),
    "utf8",
  );
  assert.match(
    workflow,
    /options:\n[\s\S]*?- npm\n[\s\S]*?- product\n[\s\S]*?- all/,
  );
  assert.match(
    workflow,
    /publish-runtime:[\s\S]*?if: \$\{\{ always\(\) && inputs\.target != 'npm'[\s\S]*?verify-npm-node-compatibility\.result == 'success'[\s\S]*?verify-npm-unsupported-node\.result == 'success'/,
  );

  const desktopJob = workflow.match(
    /\n {2}publish-desktop:([\s\S]*?)\n {2}summarize:/,
  )?.[1];
  assert.match(
    desktopJob ?? "",
    /needs: \[publish-npm, publish-runtime\]/,
    "release.yml must include the publish-desktop job",
  );
  assert.match(desktopJob, /timeout-minutes: 150/);
  assert.match(desktopJob, /always\(\) && inputs\.target == 'all'/);
  assert.match(desktopJob, /needs\.publish-runtime\.result == 'success'/);
  assert.match(desktopJob, /actions: write[\s\S]*?contents: write/);
  assert.match(
    desktopJob,
    /ref: \$\{\{ needs\.publish-npm\.outputs\.closure_commit \}\}/,
  );
  assert.match(desktopJob, /pnpm release:desktop:stable/);
  assert.match(
    desktopJob,
    /--target "\$\{\{ needs\.publish-npm\.outputs\.closure_commit \}\}"/,
  );
  assert.match(
    desktopJob,
    /--runtime-version "\$\{\{ needs\.publish-npm\.outputs\.target_version \}\}"/,
  );
  assert.match(desktopJob, /--skip-local-verify/);
  assert.doesNotMatch(
    desktopJob,
    /NPM_TOKEN|NEXTCLAW_DESKTOP_BUNDLE_PRIVATE_KEY/,
  );

  assert.match(
    workflow,
    /needs: \[publish-npm, verify-npm-node-compatibility, verify-npm-unsupported-node, publish-runtime, publish-desktop\]/,
  );
  assert.match(
    workflow,
    /if \[ "\$TARGET" = "all" \]; then[\s\S]*?"\$DESKTOP_RESULT" != "success"/,
  );
  assert.match(workflow, /## ALL_PLATFORMS_READY/);
  assert.match(
    workflow,
    /Infer release checkpoint[\s\S]*?git ls-remote --exit-code --tags origin[\s\S]*?runtime_ready=\$runtime_ready[\s\S]*?prepared_source_sha=\$prepared_source_sha[\s\S]*?--prepared-source-sha "\$\{\{ needs\.publish-npm\.outputs\.prepared_source_sha \|\| github\.sha \}\}"[\s\S]*?Reuse published stable Runtime channel[\s\S]*?darwin-arm64 darwin-x64 linux-x64 win32-x64/,
  );

  const desktopWorkflow = readFileSync(
    new URL("../../.github/workflows/desktop-release.yml", import.meta.url),
    "utf8",
  );
  assert.match(
    desktopWorkflow,
    /require-draft-release:[\s\S]*?timeout-minutes: 5/,
  );

  assertPortableRuntimeBuildContract();
  assert.match(
    desktopWorkflow,
    /publish-release-assets:[\s\S]*?timeout-minutes: 15/,
  );
  assert.match(
    desktopWorkflow,
    /publish-github-release:[\s\S]*?timeout-minutes: 10/,
  );
  assert.match(
    desktopWorkflow,
    /publish-desktop-update-channels:[\s\S]*?timeout-minutes: 15/,
  );
  assert.match(
    desktopWorkflow,
    /publish-linux-apt-repo:[\s\S]*?timeout-minutes: 25/,
  );

  const desktopReleaseScript = readFileSync(
    new URL("./release-desktop.mjs", import.meta.url),
    "utf8",
  );
  const desktopClosure = readFileSync(
    new URL("./desktop-release-closure.mjs", import.meta.url),
    "utf8",
  );
  assert.match(desktopReleaseScript, /DEFAULT_RUN_ATTEMPTS = 720/);
  assert.match(desktopClosure, /gh["], \["run", "cancel"/);
});

test("stable release exposes only the business target and infers recovery checkpoints", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/release.yml", import.meta.url), "utf8");
  assert.doesNotMatch(workflow, /resume_version|resume_previous_version/);
  assert.match(workflow, /Infer release checkpoint[\s\S]*?is_recovery=\$is_recovery/);
});

test("only all-platform releases require complete content before package publication", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/release.yml", import.meta.url),
    "utf8",
  );
  const release = readFileSync(
    new URL("./release-stable.mjs", import.meta.url),
    "utf8",
  );
  const contentGuard = release.indexOf("if (options.requireProductArtifacts)");
  const packagePublish = release.indexOf("await publishStablePackages(");

  assert.match(workflow, /RELEASE_TARGET: \$\{\{ inputs\.target \}\}/);
  assert.match(workflow, /if \[ "\$RELEASE_TARGET" = "all" \]; then[\s\S]*?--require-product-artifacts/);
  assert.doesNotMatch(
    workflow,
    /if \[ "\$RELEASE_TARGET" != "npm" \]; then[\s\S]*?--require-product-artifacts/,
  );
  assert.ok(contentGuard >= 0, "stable release must expose the all-platform content guard");
  assert.ok(
    contentGuard < packagePublish,
    "all-platform content must be validated before package publication",
  );
});

test("stable recovery runs current verification scripts against the immutable package identity", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/release.yml", import.meta.url),
    "utf8",
  );
  const verificationJobs = workflow.match(
    /\n  verify-npm-node-compatibility:([\s\S]*?)\n  publish-desktop:/,
  )?.[1];
  assert.equal(
    verificationJobs?.match(
      /ref: \$\{\{ github\.sha \}\}/g,
    )?.length ?? 0,
    2,
  );
  assert.match(
    workflow,
    /publish-runtime:[\s\S]*?ref: \$\{\{ needs\.publish-npm\.outputs\.closure_commit \}\}/,
  );
  assert.match(
    workflow,
    /verify-npm-node-compatibility:[\s\S]*?if: \$\{\{ needs\.publish-npm\.outputs\.has_nextclaw == 'true' \}\}[\s\S]*?verify-npm-unsupported-node:[\s\S]*?if: \$\{\{ needs\.publish-npm\.outputs\.has_nextclaw == 'true' \}\}/,
  );
});

test("published stable validation installs immutable registry tarballs", () => {
  const verifier = readFileSync(
    new URL("../../packages/nextclaw/scripts/verify-published-npm-runtime-update.mjs", import.meta.url),
    "utf8",
  );

  assert.match(
    verifier,
    /https:\/\/registry\.npmjs\.org\/nextclaw\/-\/nextclaw-\$\{version\}\.tgz/,
  );
  assert.doesNotMatch(verifier, /`nextclaw@\$\{expectedVersion\}`/);
  assert.doesNotMatch(verifier, /`nextclaw@\$\{previousVersion\}`/);
});

test("release workflow, agent contract, and command catalog share one observed auth path", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/release.yml", import.meta.url),
    "utf8",
  );
  const releaseSkill = readFileSync(
    new URL(
      "../../.agents/skills/nextclaw-npm-release/SKILL.md",
      import.meta.url,
    ),
    "utf8",
  );
  const commands = readFileSync(
    new URL("../../commands/commands.md", import.meta.url),
    "utf8",
  );

  assert.match(workflow, /environment: npm-production/);
  assert.match(workflow, /NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_TOKEN \}\}/);
  assert.doesNotMatch(workflow, /id-token: write|--trusted-publishing/);

  assert.match(releaseSkill, /EXISTING_RELEASE_PATH/);
  assert.match(
    releaseSkill,
    /gh run list --workflow release\.yml --status success --limit 1/,
  );
  assert.match(
    releaseSkill,
    /通过 GitHub Actions 发布[^\n]+不等于[^\n]+OIDC\/Trusted Publishing/,
  );

  const npmCommand = commands.match(
    /## `\/发布NPM`([\s\S]*?)(?=\n## `\/发布NPM测试版`)/,
  )?.[1];
  assert.ok(npmCommand, "the /发布NPM command contract must exist");
  assert.match(npmCommand, /EXISTING_RELEASE_PATH/);
  assert.match(npmCommand, /npm-production/);
  assert.match(npmCommand, /NPM_TOKEN/);
  assert.doesNotMatch(npmCommand, /通过 OIDC|60 秒硬目标/);
});

test("runtime workflow uses deterministic release notes fallback", () => {
  const workflow = readFileSync(
    new URL(
      "../../.github/workflows/npm-runtime-update-release.yml",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(workflow, /release-core-notes\.mjs --version/);
  assert.doesNotMatch(
    workflow,
    /Stable NPM runtime update requires \$release_notes_json/,
  );
});

test("runtime dispatcher is import-safe inside the Node test runner", async () => {
  await assert.doesNotReject(() => import("./release-beta-runtime.mjs"));
});
