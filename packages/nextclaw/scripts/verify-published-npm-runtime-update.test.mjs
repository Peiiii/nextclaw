import assert from "node:assert/strict";
import test from "node:test";

import {
  isRetryablePublishedInstallError,
  readVersionOutput,
  resolvePublishedRuntimeAsset,
  resolvePreviousPublishedRuntimeAsset,
  retryPublishedInstall,
} from "./verify-published-npm-runtime-update.mjs";

test("reads the final semantic version without treating bootstrap progress as identity", () => {
  assert.equal(
    readVersionOutput(
      "Downloading 1% (1024 bytes / 4096 bytes)\rDownloading 100% (4096 bytes / 4096 bytes)\n0.45.3\n",
      "runtime",
    ),
    "0.45.3",
  );
});
test("recognizes registry propagation and transient network failures as retryable", () => {
  assert.equal(
    isRetryablePublishedInstallError(
      new Error("npm error code ETARGET\nnpm error notarget No matching version found"),
    ),
    true,
  );
  assert.equal(
    isRetryablePublishedInstallError(new Error("npm error code E404\nNot Found")),
    true,
  );
  assert.equal(
    isRetryablePublishedInstallError(new Error("npm error code ETIMEDOUT\nnetwork read timed out")),
    true,
  );
  assert.equal(
    isRetryablePublishedInstallError(new Error("npm error code EACCES")),
    false,
  );
});

test("binds the previous Runtime fixture to the official exact-version asset", () => {
  assert.deepEqual(
    resolvePublishedRuntimeAsset("0.45.2", "darwin", "arm64"),
    {
      assetName: "nextclaw-runtime-darwin-arm64-0.45.2.zip",
      releaseTag: "nextclaw@0.45.2",
      url: "https://github.com/Peiiii/nextclaw/releases/download/nextclaw@0.45.2/nextclaw-runtime-darwin-arm64-0.45.2.zip",
    },
  );
});

test("uses the latest complete official Runtime when the previous NPM release has no Runtime", () => {
  const release = (version, count = 4) => ({ tag_name: `nextclaw@${version}`, assets:
    ["darwin-arm64", "darwin-x64", "linux-x64", "win32-x64"].slice(0, count)
      .map(target => ({ name: `nextclaw-runtime-${target}-${version}.zip` })) });
  const releases = [release("0.59.3"), release("0.59.2", 0), release("0.59.1"), release("0.59.0"),
    { ...release("0.59.2"), draft: true }, { ...release("0.59.2"), prerelease: true }];
  assert.equal(resolvePreviousPublishedRuntimeAsset(releases, "0.59.2", "linux", "x64").version, "0.59.1");
  assert.equal(resolvePreviousPublishedRuntimeAsset([...releases, release("0.59.2", 3)], "0.59.2", "linux", "x64").version, "0.59.1");
  assert.equal(resolvePreviousPublishedRuntimeAsset([release("0.59.9"), release("0.59.10")], "0.59.10", "linux", "x64").version, "0.59.10");
  assert.throws(() => resolvePreviousPublishedRuntimeAsset([release("0.59.2", 0)], "0.59.2", "linux", "x64"), /No complete official stable Runtime/);
});

test("retries transient published downloads but stops on success or permanent failure", async () => {
  let calls = 0;
  const delays = [];
  const result = await retryPublishedInstall(() => {
    if (++calls < 3) throw new Error("npm error code E404");
    return "downloaded exact version";
  }, async (delay) => { delays.push(delay); });
  assert.equal(result, "downloaded exact version");
  assert.equal(calls, 3);
  assert.deepEqual(delays, [5000, 5000]);
  calls = 0;
  await assert.rejects(retryPublishedInstall(() => {
    calls += 1;
    throw new Error("npm error code EACCES");
  }, async () => { throw new Error("must not wait"); }), /EACCES/);
  assert.equal(calls, 1);
});

test("bounds published download recovery and returns the final propagation error", async () => {
  let calls = 0;
  let waits = 0;
  await assert.rejects(retryPublishedInstall(() => {
    calls += 1;
    throw new Error("npm error code ETARGET");
  }, async () => { waits += 1; }), /ETARGET/);
  assert.equal(calls, 6);
  assert.equal(waits, 5);
});
