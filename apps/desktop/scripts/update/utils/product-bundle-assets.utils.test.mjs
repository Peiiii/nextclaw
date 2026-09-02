import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import JSZip from "jszip";
import { resolveDesktopNativeResourcePackageNames } from "../../prepare-native-app-resources.mjs";
import {
  assertPreparedProductBundle,
  copyProductBundleAssets,
  createProductBundleAssetInventory,
  resolveProductBundleAssetFiles,
  validateProductBundleAssetContract,
  verifyProductBundleArchive
} from "./product-bundle-assets.utils.mjs";

const fixtureContract = Object.freeze({
  schemaVersion: 1,
  runtimeFileBudget: 50,
  generatedRequiredPaths: Object.freeze(["runtime/index.js"]),
  packagedExtensions: Object.freeze([]),
  assets: Object.freeze([
    Object.freeze({
      id: "opaque-file",
      kind: "file",
      sourceRoot: "static",
      sourcePath: "asset.wasm",
      targetPaths: Object.freeze(["runtime/asset.wasm"])
    }),
    Object.freeze({
      id: "resource-tree",
      kind: "tree",
      sourceRoot: "static",
      sourcePath: "resources",
      targetPaths: Object.freeze(["runtime/resources"]),
      requiredEntries: Object.freeze(["required.txt"])
    }),
    Object.freeze({
      id: "generated-chunks",
      kind: "pattern",
      sourceRoot: "generated",
      sourcePath: ".",
      targetPaths: Object.freeze(["runtime/chunks"]),
      match: /^chunk-.+\.js$/,
      minimumMatches: 1
    }),
    Object.freeze({
      id: "native-runtime-dependencies",
      kind: "prepared-tree",
      sourceRoot: "native",
      sourcePath: "node_modules",
      targetPaths: Object.freeze(["node_modules"])
    }),
    Object.freeze({
      id: "windows-only",
      kind: "file",
      sourceRoot: "static",
      sourcePath: "windows.dll",
      targetPaths: Object.freeze(["runtime/windows.dll"]),
      platforms: Object.freeze(["win32"])
    })
  ])
});

function writeFixtureFile(path, contents = "fixture") {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function createFixture({ platform = "linux", arch = "x64" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "nextclaw-product-bundle-assets-"));
  const sourceRoots = {
    static: join(root, "static"),
    generated: join(root, "generated"),
    native: join(root, "native")
  };
  writeFixtureFile(join(sourceRoots.static, "asset.wasm"), "wasm");
  writeFixtureFile(join(sourceRoots.static, "windows.dll"), "windows");
  writeFixtureFile(join(sourceRoots.static, "resources", "required.txt"), "required");
  writeFixtureFile(join(sourceRoots.static, "resources", "nested", "other.txt"), "other");
  writeFixtureFile(join(sourceRoots.generated, "chunk-a.js"), "chunk");
  const target = `${platform}-${arch}`;
  const nativePackageNames = resolveDesktopNativeResourcePackageNames(platform, arch);
  for (const packageName of nativePackageNames) {
    writeFixtureFile(join(sourceRoots.native, "node_modules", ...packageName.split("/"), "package.json"), "{}");
  }
  writeFixtureFile(
    join(sourceRoots.native, "node_modules", "@img", `sharp-${target}`, "lib", `sharp-${target}.node`),
    "native"
  );
  if (nativePackageNames.includes(`@img/sharp-libvips-${target}`)) {
    writeFixtureFile(
      join(sourceRoots.native, "node_modules", "@img", `sharp-libvips-${target}`, "lib", "libvips.so"),
      "libvips"
    );
  }
  return {
    root,
    sourceRoots,
    bundleRoot: join(root, "bundle"),
    archivePath: join(root, "bundle.zip"),
    nativePackageNames
  };
}

async function addDirectoryToZip(zip, sourceDir, zipRoot) {
  for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = `${zipRoot}/${entry.name}`;
    if ((await stat(sourcePath)).isDirectory()) {
      await addDirectoryToZip(zip, sourcePath, targetPath);
    } else {
      zip.file(targetPath, readFileSync(sourcePath));
    }
  }
}

async function createValidArchive(fixture, { platform = "linux", arch = "x64" } = {}) {
  const declaredAssets = await copyProductBundleAssets({
    bundleRoot: fixture.bundleRoot,
    sourceRoots: fixture.sourceRoots,
    platform,
    arch,
    contract: fixtureContract
  });
  await mkdir(join(fixture.bundleRoot, "runtime"), { recursive: true });
  await writeFile(join(fixture.bundleRoot, "runtime", "index.js"), "entrypoint");
  assertPreparedProductBundle({
    bundleRoot: fixture.bundleRoot,
    platform,
    arch,
    declaredAssets,
    nativeRuntimeDependencies: fixture.nativePackageNames,
    packagedExtensions: [],
    contract: fixtureContract
  });
  const manifest = {
    bundleVersion: "test",
    platform,
    arch,
    assetContract: {
      schemaVersion: 1,
      declaredAssets,
      nativeRuntimeDependencies: fixture.nativePackageNames,
      packagedExtensions: [],
      inventory: createProductBundleAssetInventory(fixture.bundleRoot)
    }
  };
  writeFixtureFile(join(fixture.bundleRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const zip = new JSZip();
  await addDirectoryToZip(zip, fixture.bundleRoot, basename(fixture.bundleRoot));
  await writeFile(fixture.archivePath, await zip.generateAsync({ type: "nodebuffer" }));
}

async function mutateArchive(sourcePath, targetPath, mutate) {
  const archive = await JSZip.loadAsync(readFileSync(sourcePath));
  await mutate(archive);
  await writeFile(targetPath, await archive.generateAsync({ type: "nodebuffer" }));
}

async function mutateArchiveManifest(sourcePath, targetPath, mutate) {
  await mutateArchive(sourcePath, targetPath, async (archive) => {
    const manifest = JSON.parse(await archive.file("bundle/manifest.json").async("string"));
    mutate(manifest);
    archive.file("bundle/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
  });
}

test("copies every supported asset kind and verifies the final archive inventory", async (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  await createValidArchive(fixture);
  const result = await verifyProductBundleArchive(fixture.archivePath, {
    platform: "linux",
    arch: "x64",
    contract: fixtureContract
  });
  assert.equal(result.manifest.bundleVersion, "test");
  assert.ok(result.manifest.assetContract.declaredAssets.some((asset) => asset.id === "native-runtime-dependencies"));
  assert.ok(!result.manifest.assetContract.declaredAssets.some((asset) => asset.id === "windows-only"));
});

test("applies Windows-only assets and validates the Windows native runtime contract", async (t) => {
  const fixture = createFixture({ platform: "win32", arch: "x64" });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  await createValidArchive(fixture, { platform: "win32", arch: "x64" });
  const result = await verifyProductBundleArchive(fixture.archivePath, {
    platform: "win32",
    arch: "x64",
    contract: fixtureContract
  });
  const windowsAsset = result.manifest.assetContract.declaredAssets.find((asset) => asset.id === "windows-only");
  assert.deepEqual(windowsAsset?.paths, ["runtime/windows.dll"]);
  assert.ok(result.nativeRuntimeDependencies.includes("@img/sharp-win32-x64"));
  assert.ok(!result.nativeRuntimeDependencies.some((name) => name.includes("sharp-libvips-win32")));
});

test("rejects missing, unexpected, and modified files in the final archive", async (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  await createValidArchive(fixture);
  const missingPath = join(fixture.root, "missing.zip");
  await mutateArchive(fixture.archivePath, missingPath, (archive) => archive.remove("bundle/runtime/asset.wasm"));
  await assert.rejects(() => verifyProductBundleArchive(missingPath, { contract: fixtureContract }), /inventory mismatch/);

  const unexpectedPath = join(fixture.root, "unexpected.zip");
  await mutateArchive(fixture.archivePath, unexpectedPath, (archive) => archive.file("bundle/runtime/unexpected.bin", "extra"));
  await assert.rejects(() => verifyProductBundleArchive(unexpectedPath, { contract: fixtureContract }), /inventory mismatch/);

  const modifiedPath = join(fixture.root, "modified.zip");
  await mutateArchive(fixture.archivePath, modifiedPath, (archive) => archive.file("bundle/runtime/asset.wasm", "changed"));
  await assert.rejects(() => verifyProductBundleArchive(modifiedPath, { contract: fixtureContract }), /integrity mismatch/);
});

test("rejects target, native package, and declared asset manifest drift", async (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  await createValidArchive(fixture);

  await assert.rejects(
    () => verifyProductBundleArchive(fixture.archivePath, { platform: "win32", arch: "x64", contract: fixtureContract }),
    /target mismatch/
  );

  const nativeDriftPath = join(fixture.root, "native-drift.zip");
  await mutateArchiveManifest(fixture.archivePath, nativeDriftPath, (manifest) => {
    manifest.assetContract.nativeRuntimeDependencies.pop();
  });
  await assert.rejects(
    () => verifyProductBundleArchive(nativeDriftPath, { contract: fixtureContract }),
    /manifest native dependency mismatch/
  );

  const declarationDriftPath = join(fixture.root, "declaration-drift.zip");
  await mutateArchiveManifest(fixture.archivePath, declarationDriftPath, (manifest) => {
    manifest.assetContract.declaredAssets.pop();
  });
  await assert.rejects(
    () => verifyProductBundleArchive(declarationDriftPath, { contract: fixtureContract }),
    /declared asset contract mismatch/
  );
});

test("rejects invalid contracts, target collisions, missing sources, and empty patterns", async (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  assert.throws(
    () => validateProductBundleAssetContract({ ...fixtureContract, assets: [{ ...fixtureContract.assets[0], targetPaths: ["../escape"] }] }),
    /stay inside/
  );
  const collidingContract = {
    ...fixtureContract,
    assets: [
      fixtureContract.assets[0],
      { ...fixtureContract.assets[0], id: "collision", sourcePath: "windows.dll" }
    ]
  };
  await assert.rejects(
    () => resolveProductBundleAssetFiles({ sourceRoots: fixture.sourceRoots, platform: "linux", arch: "x64", contract: collidingContract }),
    /target collision/
  );
  const prefixCollidingContract = {
    ...fixtureContract,
    assets: [
      fixtureContract.assets[0],
      {
        ...fixtureContract.assets[0],
        id: "prefix-collision",
        sourcePath: "windows.dll",
        targetPaths: ["runtime/asset.wasm/nested.bin"]
      }
    ]
  };
  await assert.rejects(
    () => resolveProductBundleAssetFiles({
      sourceRoots: fixture.sourceRoots,
      platform: "linux",
      arch: "x64",
      contract: prefixCollidingContract
    }),
    /target collision/
  );
  await assert.rejects(
    () => resolveProductBundleAssetFiles({ sourceRoots: { ...fixture.sourceRoots, static: join(fixture.root, "missing") }, contract: fixtureContract }),
    /source is missing/
  );
  rmSync(join(fixture.sourceRoots.generated, "chunk-a.js"));
  await assert.rejects(
    () => resolveProductBundleAssetFiles({ sourceRoots: fixture.sourceRoots, platform: "linux", arch: "x64", contract: fixtureContract }),
    /expected at least 1/
  );
});
