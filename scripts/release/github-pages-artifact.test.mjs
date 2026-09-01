import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  APT_PACKAGE_SOURCE_SCHEMA,
  assertCompactGitHubPagesState,
  createAptPackageSource,
  materializeGitHubPagesArtifact,
  parseAptPackages
} from "./github-pages-artifact.mjs";

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function createFixture() {
  const root = await mkdtemp(join(os.tmpdir(), "nextclaw-pages-artifact-"));
  const stateDirectory = join(root, "state");
  const packageContent = Buffer.from("nextclaw-debian-package-fixture");
  const assetName = "nextclaw-desktop_0.0.278_amd64.deb";
  const releaseAssetName = "nextclaw-desktop_0.0.278_amd64.pages.deb";
  const packagePath = `pool/main/n/nextclaw-desktop/${assetName}`;
  const aptPackagePath = join(root, assetName);
  const releaseAssetPath = join(root, releaseAssetName);
  const packagesPath = join(stateDirectory, "apt/dists/stable/main/binary-amd64/Packages");
  await mkdir(join(stateDirectory, "desktop-updates/stable"), { recursive: true });
  await mkdir(join(stateDirectory, "npm-runtime-updates/stable"), { recursive: true });
  await mkdir(join(packagesPath, ".."), { recursive: true });
  await writeFile(aptPackagePath, packageContent);
  await writeFile(releaseAssetPath, packageContent);
  await writeFile(join(stateDirectory, "README.md"), "# NextClaw downloads\n");
  await writeFile(
    packagesPath,
    [
      "Package: nextclaw-desktop",
      "Version: 0.0.278",
      "Architecture: amd64",
      `Filename: ${packagePath}`,
      `Size: ${packageContent.length}`,
      `SHA256: ${sha256(packageContent)}`,
      ""
    ].join("\n")
  );
  await writeFile(join(stateDirectory, "desktop-updates/stable/manifest.json"), "{}\n");
  await writeFile(join(stateDirectory, "npm-runtime-updates/stable/manifest.json"), "{}\n");
  return {
    aptPackagePath,
    assetName,
    packageContent,
    packagesPath,
    releaseAssetName,
    releaseAssetPath,
    root,
    stateDirectory
  };
}

test("parses the NextClaw APT package contract", () => {
  const digest = "a".repeat(64);
  assert.deepEqual(
    parseAptPackages(
      `Package: nextclaw-desktop\nVersion: 1.2.3\nFilename: pool/main/n/file.deb\nSize: 42\nSHA256: ${digest}\n`
    ),
    {
      assetName: "file.deb",
      packagePath: "pool/main/n/file.deb",
      sha256: digest,
      size: 42,
      version: "1.2.3"
    }
  );
});

test("creates package source state and materializes a complete Pages artifact", async () => {
  const fixture = await createFixture();
  const sourcePath = join(fixture.stateDirectory, "apt/package-source.json");
  const source = await createAptPackageSource({
    aptPackagePath: fixture.aptPackagePath,
    outputPath: sourcePath,
    packagesPath: fixture.packagesPath,
    releaseAssetName: fixture.releaseAssetName,
    releaseTag: "v0.47.0-desktop.1"
  });
  assert.deepEqual(source, {
    schema: APT_PACKAGE_SOURCE_SCHEMA,
    releaseTag: "v0.47.0-desktop.1",
    assetName: fixture.releaseAssetName,
    packagePath: `pool/main/n/nextclaw-desktop/${fixture.assetName}`,
    size: fixture.packageContent.length,
    sha256: sha256(fixture.packageContent)
  });
  await assertCompactGitHubPagesState(fixture.stateDirectory);

  const outputDirectory = join(fixture.root, "output");
  const result = await materializeGitHubPagesArtifact({
    aptPackagePath: fixture.releaseAssetPath,
    outputDirectory,
    stateDirectory: fixture.stateDirectory
  });
  assert.equal(result.releaseTag, "v0.47.0-desktop.1");
  assert.deepEqual(
    await readFile(join(outputDirectory, "apt/pool/main/n/nextclaw-desktop", fixture.assetName)),
    fixture.packageContent
  );
  assert.equal((await stat(join(outputDirectory, "desktop-updates/stable/manifest.json"))).size, 3);
  assert.equal((await stat(join(outputDirectory, "npm-runtime-updates/stable/manifest.json"))).size, 3);
  assert.equal(await readFile(join(outputDirectory, "README.md"), "utf8"), "# NextClaw downloads\n");
});

test("rejects Pages state without a top-level entry file", async () => {
  const fixture = await createFixture();
  await createAptPackageSource({
    aptPackagePath: fixture.aptPackagePath,
    outputPath: join(fixture.stateDirectory, "apt/package-source.json"),
    packagesPath: fixture.packagesPath,
    releaseAssetName: fixture.releaseAssetName,
    releaseTag: "v0.47.0-desktop.1"
  });
  await rm(join(fixture.stateDirectory, "README.md"));
  await assert.rejects(
    materializeGitHubPagesArtifact({
      aptPackagePath: fixture.releaseAssetPath,
      outputDirectory: join(fixture.root, "output"),
      stateDirectory: fixture.stateDirectory
    }),
    /must contain a top-level entry file/u
  );
});

test("rejects a package whose digest does not match signed APT metadata", async () => {
  const fixture = await createFixture();
  await createAptPackageSource({
    aptPackagePath: fixture.aptPackagePath,
    outputPath: join(fixture.stateDirectory, "apt/package-source.json"),
    packagesPath: fixture.packagesPath,
    releaseAssetName: fixture.releaseAssetName,
    releaseTag: "v0.47.0-desktop.1"
  });
  await writeFile(fixture.releaseAssetPath, "tampered");
  await assert.rejects(
    materializeGitHubPagesArtifact({
      aptPackagePath: fixture.releaseAssetPath,
      outputDirectory: join(fixture.root, "output"),
      stateDirectory: fixture.stateDirectory
    }),
    /size mismatch|SHA256 mismatch/u
  );
});

test("rejects state branches containing a Debian package or a large file", async () => {
  const fixture = await createFixture();
  await mkdir(join(fixture.stateDirectory, "apt/pool"), { recursive: true });
  await writeFile(join(fixture.stateDirectory, "apt/pool/forbidden.deb"), "deb");
  await assert.rejects(
    assertCompactGitHubPagesState(fixture.stateDirectory),
    /must not contain Debian packages/u
  );

  const secondFixture = await createFixture();
  await writeFile(join(secondFixture.stateDirectory, "large.bin"), Buffer.alloc(1025));
  await assert.rejects(
    assertCompactGitHubPagesState(secondFixture.stateDirectory, { maxFileBytes: 1024 }),
    /exceeds 1024 bytes/u
  );
});

test("rejects unsafe APT package paths", () => {
  assert.throws(
    () =>
      parseAptPackages(
        `Package: nextclaw-desktop\nFilename: ../escape.deb\nSize: 1\nSHA256: ${"a".repeat(64)}\n`
      ),
    /must not escape/u
  );
});

test("release workflows keep Git state compact and deploy one complete Pages artifact", async () => {
  const desktopWorkflow = await readFile(
    new URL("../../.github/workflows/desktop-release.yml", import.meta.url),
    "utf8"
  );
  const runtimeWorkflow = await readFile(
    new URL("../../.github/workflows/npm-runtime-update-release.yml", import.meta.url),
    "utf8"
  );
  const pagesWorkflow = await readFile(
    new URL("../../.github/workflows/github-pages-deploy.yml", import.meta.url),
    "utf8"
  );

  assert.match(desktopWorkflow, /gh release upload[\s\S]*?create-apt-source[\s\S]*?find \.tmp\/gh-pages\/apt\/pool[^\n]+-delete/u);
  assert.equal(
    desktopWorkflow.match(/publisher\/scripts\/release\/github-pages-artifact\.mjs verify-state/g)?.length,
    2
  );
  assert.match(
    desktopWorkflow,
    /deploy-public-pages:[\s\S]*?uses: \.\/\.github\/workflows\/github-pages-deploy\.yml/u
  );
  assert.match(runtimeWorkflow, /git fetch --depth=1 origin gh-pages/u);
  assert.match(runtimeWorkflow, /publisher\/scripts\/release\/github-pages-artifact\.mjs verify-state/u);
  assert.match(
    runtimeWorkflow,
    /deploy-public-pages:[\s\S]*?uses: \.\/\.github\/workflows\/github-pages-deploy\.yml/u
  );

  assert.match(pagesWorkflow, /pages: write/u);
  assert.match(pagesWorkflow, /id-token: write/u);
  assert.match(pagesWorkflow, /gh release download/u);
  assert.match(pagesWorkflow, /github-pages-artifact\.mjs materialize/u);
  assert.match(pagesWorkflow, /actions\/upload-pages-artifact@v4/u);
  assert.match(pagesWorkflow, /actions\/deploy-pages@v4/u);
});

test("Runtime publication always evaluates the Pages deployment after promotion", async () => {
  const runtimeWorkflow = await readFile(
    new URL("../../.github/workflows/npm-runtime-update-release.yml", import.meta.url),
    "utf8"
  );
  assert.match(
    runtimeWorkflow,
    /deploy-public-pages:[\s\S]*?if: \$\{\{ always\(\) && needs\.publish-npm-runtime-update-channel\.result == 'success' \}\}/u
  );
});
