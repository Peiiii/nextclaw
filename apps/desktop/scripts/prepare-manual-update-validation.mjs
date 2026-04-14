#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
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
const defaultSupportRoot = resolve(desktopDir, "release", "manual-update-validation-support");
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

function findFirstDmg(rootDir) {
  const entries = readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(rootDir, entry.name);
    if (entry.isFile() && entry.name.endsWith(".dmg")) {
      return entryPath;
    }
  }
  return null;
}

function buildReadme({ installerDmgPath, supportRoot, stableVersion, betaVersion }) {
  return `# Desktop Release Channel Manual Validation

这是给产品本人手动验收用的标准安装包支持目录。

## 你真正要安装的文件

- DMG 安装包：${installerDmgPath}

## 安装和验证步骤

1. 双击上面的 DMG，把 \`NextClaw Desktop.app\` 拖到 \`Applications\`。
2. 双击 \`1-start-local-update-server.command\`，保持这个终端窗口不要关闭。
3. 正常从 \`Applications/NextClaw Desktop.app\` 打开应用。
4. 进入“设置 > 桌面端更新”。
5. 在 \`Stable\` 下点击“检查更新”，预期当前版本是 \`${stableVersion}\`，结果为“已是最新”。
6. 切到 \`Beta\`，再次点击“检查更新”，预期看到 \`${betaVersion}\`。
7. 下载并应用更新，重启后预期当前版本变成 \`${betaVersion}\`。
8. 再切回 \`Stable\` 检查更新，预期不会强制降级，当前版本仍保持 \`${betaVersion}\`。

## 支持目录内容

- 本地更新源根目录：${join(supportRoot, "server-root")}

## 注意

- 这是标准 DMG 安装包，不是让你直接在奇怪目录里跑 \`.app\`
- 这个验证包只把本地更新源地址烘进安装包里，标准运行数据仍会继续使用用户自己的 \`~/.nextclaw\`
- 你只需要额外启动一次本地更新源脚本，因为这次还没有把测试用 beta 版本发布到正式线上更新源
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supportRoot = resolve(args["output-dir"]?.trim() || defaultSupportRoot);
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
  const installerOutputRoot = join(supportRoot, "pack-output");
  const installerDmgPath = resolve(desktopDir, "release", "NextClaw Desktop-manual-update-validation-installer.dmg");
  rmSync(supportRoot, { recursive: true, force: true });
  rmSync(installerDmgPath, { force: true });
  mkdirSync(supportRoot, { recursive: true });

  const serverRoot = join(supportRoot, "server-root");
  const updatesRoot = join(serverRoot, "desktop-updates");
  const stableRoot = join(updatesRoot, "stable");
  const betaRoot = join(updatesRoot, "beta");
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
  const manifestBaseUrl = `http://127.0.0.1:${String(port)}/desktop-updates`;

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
    writeFileSync(
      buildReleaseMetadataPath,
      `${JSON.stringify(
        {
          channel: "stable",
          releaseTag: "manual-update-validation",
          manifestBaseUrl
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    writeFileSync(buildPublicKeyPath, publicKeyPem, "utf8");
    copyFileSync(stableSeedBundlePath, buildSeedBundlePath);

    runCommand(
      pnpmCommand,
      [
        "-C",
        "apps/desktop",
        "exec",
        "electron-builder",
        "--mac",
        "dmg",
        `--config.directories.output=${installerOutputRoot}`
      ],
      workspaceRoot,
      {
        ...process.env,
        CSC_IDENTITY_AUTO_DISCOVERY: "false"
      }
    );
  } finally {
    restoreBackups(transientBuildFiles, backupMap);
  }

  const packagedDmgPath = findFirstDmg(installerOutputRoot);
  if (!packagedDmgPath) {
    throw new Error(`Unable to find packaged dmg under ${installerOutputRoot}`);
  }
  copyFileSync(packagedDmgPath, installerDmgPath);

  writeExecutableFile(
    join(supportRoot, "1-start-local-update-server.command"),
    `#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
node "${resolve(desktopDir, "scripts", "run-local-update-server.mjs")}" --root "$SCRIPT_DIR/server-root" --port "${String(port)}"
`
  );
  writeFileSync(
    join(supportRoot, "README.md"),
    buildReadme({
      installerDmgPath,
      supportRoot,
      stableVersion,
      betaVersion
    }),
    "utf8"
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        installerDmgPath,
        supportRoot,
        stableVersion,
        betaVersion,
        startServerScript: join(supportRoot, "1-start-local-update-server.command")
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
