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

test("release workflow isolates OIDC publish permissions and serializes stable runs", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/release.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /^permissions: \{\}$/m);
  assert.match(
    workflow,
    /group: nextclaw-stable-release\n {2}cancel-in-progress: false/,
  );
  assert.match(workflow, /environment: npm-production[\s\S]*?id-token: write/);
  assert.match(workflow, /npm install --global npm@11\.5\.1/);
  assert.match(workflow, /pnpm release:npm:stable -- --trusted-publishing/);
  assert.match(workflow, /GITHUB_REF.*refs\/heads\/master/);
  assert.doesNotMatch(workflow, /OPENAI_API_KEY|ANTHROPIC_API_KEY|NPM_TOKEN/);
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
