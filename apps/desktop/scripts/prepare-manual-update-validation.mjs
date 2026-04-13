#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(desktopDir, "..", "..");
const defaultValidationRoot = resolve(desktopDir, ".local", "manual-update-validation");
const defaultStableSeedBundlePath = "/Applications/NextClaw Desktop.app/Contents/Resources/update/seed-product-bundle.zip";
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

function runCommand(command, args, cwd = workspaceRoot, env = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${String(result.status ?? 1)}`);
  }
}

async function readBundleVersion(archivePath) {
  const archive = await JSZip.loadAsync(readFileSync(archivePath));
  const manifestEntry =
    archive.file("bundle/manifest.json") ??
    Object.values(archive.files).find((entry) => entry.name.endsWith("/manifest.json"));
  if (!manifestEntry) {
    throw new Error(`Bundle archive is missing manifest.json: ${archivePath}`);
  }
  const manifest = JSON.parse(await manifestEntry.async("text"));
  const version = typeof manifest.bundleVersion === "string" ? manifest.bundleVersion.trim() : "";
  if (!version) {
    throw new Error(`Bundle archive manifest is missing bundleVersion: ${archivePath}`);
  }
  return version;
}

async function cloneBundleWithVersion(sourceArchivePath, targetArchivePath, nextVersion) {
  const archive = await JSZip.loadAsync(readFileSync(sourceArchivePath));
  const manifestEntry =
    archive.file("bundle/manifest.json") ??
    Object.values(archive.files).find((entry) => entry.name.endsWith("/manifest.json"));
  if (!manifestEntry) {
    throw new Error(`Bundle archive is missing manifest.json: ${sourceArchivePath}`);
  }
  const manifest = JSON.parse(await manifestEntry.async("text"));
  manifest.bundleVersion = nextVersion;
  manifest.uiVersion = nextVersion;
  manifest.runtimeVersion = nextVersion;
  manifest.builtInPluginSetVersion = nextVersion;
  archive.file(manifestEntry.name, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(targetArchivePath, await archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

function serializeUnsignedManifest(manifest) {
  return JSON.stringify({
    channel: manifest.channel,
    platform: manifest.platform,
    arch: manifest.arch,
    latestVersion: manifest.latestVersion,
    minimumLauncherVersion: manifest.minimumLauncherVersion,
    bundleUrl: manifest.bundleUrl,
    bundleSha256: manifest.bundleSha256,
    bundleSignature: manifest.bundleSignature,
    releaseNotesUrl: manifest.releaseNotesUrl
  });
}

function createSignedManifest({ privateKey, channel, version, bundlePath, bundleUrl, releaseNotesUrl, launcherVersion }) {
  const bundleBytes = readFileSync(bundlePath);
  const manifest = {
    channel,
    platform: process.platform,
    arch: process.arch,
    latestVersion: version,
    minimumLauncherVersion: launcherVersion,
    bundleUrl,
    bundleSha256: createHash("sha256").update(bundleBytes).digest("hex"),
    bundleSignature: sign(null, bundleBytes, privateKey).toString("base64"),
    releaseNotesUrl
  };
  return {
    ...manifest,
    manifestSignature: sign(null, Buffer.from(serializeUnsignedManifest(manifest)), privateKey).toString("base64")
  };
}

function findFirstAppBundle(rootDir) {
  const entries = readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(rootDir, entry.name);
    if (entry.isDirectory() && entry.name.endsWith(".app")) {
      return entryPath;
    }
    if (entry.isDirectory()) {
      const nested = findFirstAppBundle(entryPath);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

function createBackupMap(filePaths) {
  const backup = new Map();
  for (const filePath of filePaths) {
    if (existsSync(filePath)) {
      backup.set(filePath, readFileSync(filePath));
    }
  }
  return backup;
}

function restoreBackups(filePaths, backupMap) {
  for (const filePath of filePaths) {
    const previousBytes = backupMap.get(filePath);
    if (previousBytes) {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, previousBytes);
      continue;
    }
    rmSync(filePath, { force: true });
  }
}

function writeExecutableFile(filePath, content) {
  writeFileSync(filePath, content, "utf8");
  chmodSync(filePath, 0o755);
}

function buildReadme({
  validationRoot,
  port,
  stableVersion,
  betaVersion,
  appPath
}) {
  return `# Desktop Release Channel Manual Validation

这是给本机人工验收用的本地验证目录。

## 目录说明

- App: ${appPath}
- Local update server root: ${join(validationRoot, "server-root")}
- Runtime home: ${join(validationRoot, "runtime-home")}
- Desktop data: ${join(validationRoot, "desktop-data")}
- Local update base url: http://127.0.0.1:${String(port)}/desktop-updates

## 一次完整验证怎么做

1. 双击 \`1-start-local-update-server.command\`，保持这个终端窗口不要关闭。
2. 如果你想从头再测一遍，先双击 \`3-reset-validation-state.command\`。
3. 双击 \`2-open-validation-app.command\` 启动本地验证版桌面端。
4. 在应用里进入“设置 > 桌面端更新”。
5. 先保持 \`Stable\`，点击“检查更新”，预期当前版本是 \`${stableVersion}\`，结果是“已是最新”。
6. 把 \`Release channel\` 切到 \`Beta\`，再次点击“检查更新”，预期看到可更新版本 \`${betaVersion}\`。
7. 点击下载，等待状态变成“已下载，等待应用”。
8. 点击应用更新并重启，等待应用重新起来。
9. 重启后再次打开“设置 > 桌面端更新”，预期当前版本已经变成 \`${betaVersion}\`。
10. 再切回 \`Stable\` 并检查更新，预期不会强制降级，当前版本仍保持 \`${betaVersion}\`。

## 注意

- 这是本地人工验收包，运行数据会写到这个目录自己的 \`runtime-home\` / \`desktop-data\`，不会污染你平时的桌面端数据。
- 如果要重新从稳定版起点再测一次，执行 \`3-reset-validation-state.command\` 即可。
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const validationRoot = resolve(args["output-dir"]?.trim() || defaultValidationRoot);
  const stableSeedBundlePath = resolve(args["stable-seed-bundle"]?.trim() || defaultStableSeedBundlePath);
  const port = Number.parseInt(args.port?.trim() || "43010", 10);
  const betaVersion = args["beta-version"]?.trim() || "0.17.11";
  if (!existsSync(stableSeedBundlePath) || !statSync(stableSeedBundlePath).isFile()) {
    throw new Error(`Stable seed bundle not found: ${stableSeedBundlePath}`);
  }

  const stableVersion = await readBundleVersion(stableSeedBundlePath);
  const desktopPackage = JSON.parse(readFileSync(resolve(desktopDir, "package.json"), "utf8"));
  const productName = desktopPackage.build.productName;
  const launcherVersion = desktopPackage.version;

  rmSync(validationRoot, { recursive: true, force: true });
  mkdirSync(validationRoot, { recursive: true });

  const runtimeHome = join(validationRoot, "runtime-home");
  const desktopData = join(validationRoot, "desktop-data");
  const serverRoot = join(validationRoot, "server-root");
  const updatesRoot = join(serverRoot, "desktop-updates");
  const stableRoot = join(updatesRoot, "stable");
  const betaRoot = join(updatesRoot, "beta");
  const packagedOutputRoot = join(validationRoot, "pack-output");
  const validationAppPath = join(validationRoot, `${productName}.app`);
  mkdirSync(runtimeHome, { recursive: true });
  mkdirSync(desktopData, { recursive: true });
  mkdirSync(stableRoot, { recursive: true });
  mkdirSync(betaRoot, { recursive: true });

  const stableBundlePath = join(stableRoot, `nextclaw-bundle-${stableVersion}.zip`);
  const betaBundlePath = join(betaRoot, `nextclaw-bundle-${betaVersion}.zip`);
  copyFileSync(stableSeedBundlePath, stableBundlePath);
  await cloneBundleWithVersion(stableSeedBundlePath, betaBundlePath, betaVersion);

  const keyPair = generateKeyPairSync("ed25519");
  const publicKeyPem = keyPair.publicKey.export({ type: "spki", format: "pem" }).toString();

  const manifestAssetName = (channel) => `manifest-${channel}-${process.platform}-${process.arch}.json`;
  const stableBundleUrl = `http://127.0.0.1:${String(port)}/desktop-updates/stable/${basename(stableBundlePath)}`;
  const betaBundleUrl = `http://127.0.0.1:${String(port)}/desktop-updates/beta/${basename(betaBundlePath)}`;
  const stableReleaseNotesUrl = `http://127.0.0.1:${String(port)}/desktop-updates/stable/release-notes-${stableVersion}.txt`;
  const betaReleaseNotesUrl = `http://127.0.0.1:${String(port)}/desktop-updates/beta/release-notes-${betaVersion}.txt`;

  writeFileSync(join(stableRoot, `release-notes-${stableVersion}.txt`), `NextClaw stable ${stableVersion}\n`, "utf8");
  writeFileSync(join(betaRoot, `release-notes-${betaVersion}.txt`), `NextClaw beta ${betaVersion}\n`, "utf8");
  writeFileSync(
    join(stableRoot, manifestAssetName("stable")),
    `${JSON.stringify(
      createSignedManifest({
        privateKey: keyPair.privateKey,
        channel: "stable",
        version: stableVersion,
        bundlePath: stableBundlePath,
        bundleUrl: stableBundleUrl,
        releaseNotesUrl: stableReleaseNotesUrl,
        launcherVersion
      }),
      null,
      2
    )}\n`,
    "utf8"
  );
  writeFileSync(
    join(betaRoot, manifestAssetName("beta")),
    `${JSON.stringify(
      createSignedManifest({
        privateKey: keyPair.privateKey,
        channel: "beta",
        version: betaVersion,
        bundlePath: betaBundlePath,
        bundleUrl: betaBundleUrl,
        releaseNotesUrl: betaReleaseNotesUrl,
        launcherVersion
      }),
      null,
      2
    )}\n`,
    "utf8"
  );

  const buildReleaseMetadataPath = resolve(desktopDir, "build", "update-release-metadata.json");
  const buildPublicKeyPath = resolve(desktopDir, "build", "update-bundle-public.pem");
  const buildSeedBundlePath = resolve(desktopDir, "build", "update", "seed-product-bundle.zip");
  const transientBuildFiles = [buildReleaseMetadataPath, buildPublicKeyPath, buildSeedBundlePath];
  const backupMap = createBackupMap(transientBuildFiles);
  try {
    mkdirSync(dirname(buildReleaseMetadataPath), { recursive: true });
    mkdirSync(dirname(buildPublicKeyPath), { recursive: true });
    mkdirSync(dirname(buildSeedBundlePath), { recursive: true });
    writeFileSync(buildReleaseMetadataPath, `${JSON.stringify({ channel: "stable", releaseTag: null }, null, 2)}\n`, "utf8");
    writeFileSync(buildPublicKeyPath, publicKeyPem, "utf8");
    copyFileSync(stableSeedBundlePath, buildSeedBundlePath);

    runCommand(pnpmCommand, ["-C", "apps/desktop", "build:main"]);
    runCommand(
      pnpmCommand,
      ["-C", "apps/desktop", "exec", "electron-builder", "--dir", `--config.directories.output=${packagedOutputRoot}`],
      workspaceRoot,
      {
        ...process.env,
        CSC_IDENTITY_AUTO_DISCOVERY: "false"
      }
    );
  } finally {
    restoreBackups(transientBuildFiles, backupMap);
  }

  const packagedAppSource = findFirstAppBundle(packagedOutputRoot);
  if (!packagedAppSource) {
    throw new Error(`Unable to find packaged app bundle under ${packagedOutputRoot}`);
  }
  cpSync(packagedAppSource, validationAppPath, { recursive: true });

  writeExecutableFile(
    join(validationRoot, "1-start-local-update-server.command"),
    `#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
node "${resolve(desktopDir, "scripts", "run-local-update-server.mjs")}" --root "$SCRIPT_DIR/server-root" --port "${String(port)}"
`
  );
  writeExecutableFile(
    join(validationRoot, "2-open-validation-app.command"),
    `#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export NEXTCLAW_DESKTOP_UPDATE_MANIFEST_BASE_URL="http://127.0.0.1:${String(port)}/desktop-updates"
export NEXTCLAW_DESKTOP_RUNTIME_HOME_OVERRIDE="$SCRIPT_DIR/runtime-home"
export NEXTCLAW_DESKTOP_DATA_DIR_OVERRIDE="$SCRIPT_DIR/desktop-data"
exec "$SCRIPT_DIR/${productName}.app/Contents/MacOS/${productName}"
`
  );
  writeExecutableFile(
    join(validationRoot, "3-reset-validation-state.command"),
    `#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
rm -rf "$SCRIPT_DIR/runtime-home" "$SCRIPT_DIR/desktop-data"
mkdir -p "$SCRIPT_DIR/runtime-home" "$SCRIPT_DIR/desktop-data"
echo "Validation state reset to a clean stable starting point."
`
  );
  writeFileSync(
    join(validationRoot, "README.md"),
    buildReadme({
      validationRoot,
      port,
      stableVersion,
      betaVersion,
      appPath: validationAppPath
    }),
    "utf8"
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        validationRoot,
        stableVersion,
        betaVersion,
        appPath: validationAppPath,
        startServerScript: join(validationRoot, "1-start-local-update-server.command"),
        openAppScript: join(validationRoot, "2-open-validation-app.command"),
        resetStateScript: join(validationRoot, "3-reset-validation-state.command")
      },
      null,
      2
    )}\n`
  );
}

function basename(filePath) {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1];
}

main().catch((error) => {
  console.error(`[prepare-manual-update-validation] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
