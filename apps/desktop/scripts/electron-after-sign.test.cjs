const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { collectAdhocNativeCodePaths } = require("./electron-after-sign.cjs");

test("collects nested macOS native code inside-out without signing ordinary assets", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nextclaw-signing-test-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const nativeAddon = path.join(root, "Contents", "Resources", "app.asar.unpacked", "sharp", "sharp.node");
  const frameworkLibrary = path.join(root, "Contents", "Frameworks", "Electron.framework", "Libraries", "libffmpeg.dylib");
  const ordinaryAsset = path.join(root, "Contents", "Resources", "index.js");
  for (const filePath of [nativeAddon, frameworkLibrary, ordinaryAsset]) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "fixture");
  }

  assert.deepEqual(collectAdhocNativeCodePaths(root), [frameworkLibrary, nativeAddon]);
});
