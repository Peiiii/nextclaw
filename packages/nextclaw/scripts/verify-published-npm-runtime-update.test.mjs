import assert from "node:assert/strict";
import test from "node:test";

import {
  isRegistryVisibilityError,
  readVersionOutput,
  resolvePublishedRuntimeAsset,
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
test("recognizes only bounded registry propagation failures as retryable", () => {
  assert.equal(
    isRegistryVisibilityError(
      new Error("npm error code ETARGET\nnpm error notarget No matching version found"),
    ),
    true,
  );
  assert.equal(
    isRegistryVisibilityError(new Error("npm error code E404\nNot Found")),
    true,
  );
  assert.equal(
    isRegistryVisibilityError(new Error("npm error code EACCES")),
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
