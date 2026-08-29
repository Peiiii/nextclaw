import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertPublishedDesktopRuntimeIdentity,
  selectPreflightWorkflowRun
} from "./desktop-release-preflight.mjs";
import {
  selectPreparedRuntimeWorkflowRun,
  selectRuntimeWorkflowRun,
} from "./release-beta-runtime.mjs";
import { verifyPublicRuntimeManifests } from "./release-runtime-manifest-verify.mjs";

test("workflow dispatch selectors use unique caller identity instead of mutable branch head", () => {
  const startedAt = Date.parse("2026-08-26T00:00:00Z");
  const runs = [
    {
      createdAt: "2026-08-26T00:00:01Z",
      displayTitle: "other dispatch=other-id",
      event: "workflow_dispatch",
      headSha: "frozen"
    },
    {
      createdAt: "2026-08-26T00:00:02Z",
      displayTitle: "target dispatch=mine",
      event: "workflow_dispatch",
      headSha: "new-master"
    }
  ];
  assert.equal(selectPreflightWorkflowRun(runs, "mine", startedAt)?.headSha, "new-master");
  assert.equal(selectRuntimeWorkflowRun(runs, "mine", startedAt)?.headSha, "new-master");
});

test("stable Runtime promotion selects only the completed exact-source prepare run", () => {
  const runs = [
    { headSha: "wanted", status: "in_progress", conclusion: "", databaseId: 1 },
    { headSha: "other", status: "completed", conclusion: "success", databaseId: 2 },
    { headSha: "wanted", status: "completed", conclusion: "success", databaseId: 3 },
  ];
  assert.equal(selectPreparedRuntimeWorkflowRun(runs, "wanted")?.databaseId, 3);
});

test("published runtime identity retries unavailable registry reads without calling them missing", () => {
  const calls = new Map();
  assert.doesNotThrow(() =>
    assertPublishedDesktopRuntimeIdentity("stable", "0.43.0", {
      attempts: 3,
      runCommand: (_command, args) => {
        const packageSpec = args[1];
        const count = (calls.get(packageSpec) ?? 0) + 1;
        calls.set(packageSpec, count);
        if (count === 1) throw new Error("registry unavailable");
        return "0.43.0";
      },
      sleep: () => {}
    })
  );
  assert.deepEqual([...calls.values()], [3, 2]);
});

test("published runtime identity waits for a stale dist-tag projection", () => {
  let latestReads = 0;
  assert.doesNotThrow(() =>
    assertPublishedDesktopRuntimeIdentity("stable", "0.43.0", {
      attempts: 3,
      runCommand: (_command, args) => {
        if (args[1] === "nextclaw@0.43.0") return "0.43.0";
        latestReads += 1;
        return latestReads < 3 ? "0.42.0" : "0.43.0";
      },
      sleep: () => {}
    })
  );
  assert.equal(latestReads, 3);
});

test("published runtime identity distinguishes persistent unavailability from a confirmed mismatch", () => {
  assert.throws(
    () =>
      assertPublishedDesktopRuntimeIdentity("stable", "0.43.0", {
        attempts: 2,
        runCommand: () => { throw new Error("registry unavailable"); },
        sleep: () => {}
      }),
    /Could not confirm published NPM identity after 2 attempts/
  );
  assert.throws(
    () =>
      assertPublishedDesktopRuntimeIdentity("stable", "0.43.0", {
        runCommand: () => "0.42.0",
        sleep: () => {}
      }),
    /requires an already published nextclaw stable identity after 6 attempts: exact=0\.42\.0, latest=0\.42\.0/
  );
});

test("release workflows bind dispatch identity and immutable source commits", () => {
  const preflight = readFileSync(new URL("../../.github/workflows/desktop-release-preflight.yml", import.meta.url), "utf8");
  const runtime = readFileSync(new URL("../../.github/workflows/npm-runtime-update-release.yml", import.meta.url), "utf8");
  const prepare = readFileSync(new URL("../../.github/workflows/npm-release-prepare.yml", import.meta.url), "utf8");
  const release = readFileSync(new URL("../../.github/workflows/release.yml", import.meta.url), "utf8");

  assert.match(preflight, /run-name: .*dispatch=\$\{\{ inputs\.dispatch_id \}\}/);
  assert.match(preflight, /ref: \$\{\{ inputs\.target_sha \}\}/);
  assert.match(preflight, /node-version: \$\{\{ inputs\.node_version \}\}/);
  assert.match(runtime, /run-name: .*target=\$\{\{ inputs\.release_target \}\} dispatch=\$\{\{ inputs\.dispatch_id \}\}/);
  assert.equal(runtime.match(/ref: \$\{\{ inputs\.release_target \}\}/g)?.length, 2);
  assert.match(prepare, /group: npm-release-prepare-\$\{\{ inputs\.source_sha \|\| github\.sha \}\}/);
  assert.match(prepare, /cancel-in-progress: false/);
  assert.match(prepare, /name: npm-release-prepared-\$\{\{ env\.NPM_RELEASE_SOURCE_SHA \}\}/);
  assert.match(prepare, /uses: \.\/\.github\/workflows\/npm-runtime-update-release\.yml/);
  assert.match(prepare, /publish: false/);
  assert.match(prepare, /prepare-runtime:[\s\S]*permissions:[\s\S]*contents: write/);
  assert.match(runtime, /prepared_run_id:/);
  assert.match(runtime, /run-id: \$\{\{ inputs\.prepared_run_id \}\}/);
  assert.match(runtime, /Verify prepared Runtime identity and completeness/);
  assert.match(release, /--prepared-source-sha "\$\{\{ github\.sha \}\}"/);
  assert.match(release, /timeout-minutes: 45/);
  assert.match(release, /actions: write/);
});

test("runtime manifest verification waits through missing and stale gh-pages projections", async () => {
  let ghPagesReads = 0;
  const expected = {
    hostKind: "npm-runtime-bundle",
    latestVersion: "0.43.0",
    releaseNotesUrl: "https://example.test/notes"
  };
  const result = await verifyPublicRuntimeManifests({
    channel: "stable",
    expectedReleaseNotesUrl: expected.releaseNotesUrl,
    expectedVersion: expected.latestVersion,
    readJsonCommand: (command) => command === "gh" ? { status: "built" } : expected,
    repo: "Peiiii/nextclaw",
    run: () => {
      ghPagesReads += 1;
      if (ghPagesReads === 1) throw new Error("not found");
      const manifest = ghPagesReads === 2 ? { ...expected, latestVersion: "0.42.0" } : expected;
      return Buffer.from(JSON.stringify(manifest)).toString("base64");
    },
    sleep: async () => {},
    targets: [{ platform: "linux", arch: "x64" }]
  });
  assert.equal(ghPagesReads, 3);
  assert.deepEqual(result, { pagesStatus: "built", source: "public" });
});

test("runtime manifest verification does not retry a confirmed immutable-field mismatch", async () => {
  let reads = 0;
  await assert.rejects(
    verifyPublicRuntimeManifests({
      channel: "stable",
      expectedReleaseNotesUrl: "https://example.test/notes",
      expectedVersion: "0.43.0",
      readJsonCommand: () => ({ status: "built" }),
      repo: "Peiiii/nextclaw",
      run: () => {
        reads += 1;
        return Buffer.from(JSON.stringify({
          hostKind: "wrong-kind",
          latestVersion: "0.43.0",
          releaseNotesUrl: "https://example.test/notes"
        })).toString("base64");
      },
      sleep: async () => {},
      targets: [{ platform: "linux", arch: "x64" }]
    }),
    /hostKind mismatch/
  );
  assert.equal(reads, 1);
});
