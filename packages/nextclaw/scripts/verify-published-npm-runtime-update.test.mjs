import assert from "node:assert/strict";
import test from "node:test";

import {
  isRetryablePublishedInstallError,
  readVersionOutput,
  resolvePublishedRuntimeAsset,
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
