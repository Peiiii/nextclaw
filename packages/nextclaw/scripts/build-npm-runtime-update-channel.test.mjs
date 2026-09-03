import assert from "node:assert/strict";
import { access, chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { generateKeyPairSync, verify } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import JSZip from "jszip";
import {
  addDirectoryToZip,
  assertPortableRunnerResource,
  resolvePortableRunnerResourcePath,
  serializeUnsignedManifest,
  signUpdateManifest,
} from "./build-npm-runtime-update-channel.mjs";

test("stable compatibility manifests can be independently signed for the beta channel", () => {
  const keyPair = generateKeyPairSync("ed25519");
  const stable = {
    channel: "stable",
    platform: "darwin",
    arch: "arm64",
    hostKind: "npm-runtime-bundle",
    latestVersion: "0.48.1",
    minimumLauncherVersion: "0.18.11",
    bundleUrl: "https://example.test/runtime.zip",
    bundleSha256: "sha256",
    bundleSignature: "bundle-signature",
    releaseNotesUrl: null
  };
  const beta = { ...stable, channel: "beta" };
  const signedBeta = signUpdateManifest(beta, keyPair.privateKey);

  assert.equal(beta.bundleUrl, stable.bundleUrl);
  assert.equal(beta.latestVersion, stable.latestVersion);
  assert.equal(
    verify(
      null,
      Buffer.from(serializeUnsignedManifest(beta)),
      keyPair.publicKey,
      Buffer.from(signedBeta.manifestSignature, "base64")
    ),
    true
  );
});

test("rejects a runtime bundle when its platform runner is missing", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "nextclaw-runtime-runner-missing-"));
  context.after(async () => await rm(root, { recursive: true, force: true }));

  await assert.rejects(
    assertPortableRunnerResource(root, "linux", "x64"),
    /missing the Portable Service App runner for linux-x64/,
  );
});

test("preserves the Unix runner executable mode in the runtime ZIP", { skip: process.platform === "win32" }, async (context) => {
  const root = await mkdtemp(join(tmpdir(), "nextclaw-runtime-runner-zip-"));
  context.after(async () => await rm(root, { recursive: true, force: true }));
  const runnerPath = resolvePortableRunnerResourcePath(root, "linux", "x64");
  await mkdir(dirname(runnerPath), { recursive: true });
  await writeFile(runnerPath, "runner");
  await chmod(runnerPath, 0o755);

  await assertPortableRunnerResource(root, "linux", "x64");
  await access(runnerPath, constants.X_OK);
  const zip = new JSZip();
  await addDirectoryToZip(zip, root, "runtime");
  const archive = await zip.generateAsync({ type: "nodebuffer", platform: "UNIX" });
  const loaded = await JSZip.loadAsync(archive);
  const entry = loaded.file("runtime/resources/native/linux-x64/nextclaw-wasmtime-runner");

  assert.ok(entry);
  assert.equal(Number(entry.unixPermissions) & 0o777, 0o755);
});
