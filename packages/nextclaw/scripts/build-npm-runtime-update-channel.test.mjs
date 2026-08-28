import assert from "node:assert/strict";
import { access, chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import JSZip from "jszip";
import {
  addDirectoryToZip,
  assertPortableRunnerResource,
  resolvePortableRunnerResourcePath,
} from "./build-npm-runtime-update-channel.mjs";

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
