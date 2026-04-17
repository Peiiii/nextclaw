#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
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
import { prepareLocalUpdateChannelArtifacts } from "./update/services/local-update-channel-artifacts.service.mjs";

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

function buildManualValidationInstaller({
  publicKeyPem,
  manifestBaseUrl,
  stableSeedBundlePath,
  installerOutputRoot
}) {
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
}

function finalizeManualValidationSupport({
  supportRoot,
  port,
  installerDmgPath,
  stableVersion,
  betaVersion
}) {
  const startServerScript = join(supportRoot, "1-start-local-update-server.command");
  writeExecutableFile(
    startServerScript,
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
  return startServerScript;
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

  const keyPair = generateKeyPairSync("ed25519");
  const publicKeyPem = keyPair.publicKey.export({ type: "spki", format: "pem" }).toString();
  const manifestBaseUrl = `http://127.0.0.1:${String(port)}/desktop-updates`;
  await prepareLocalUpdateChannelArtifacts({
    stableSeedBundlePath,
    stableVersion,
    betaVersion,
    stableRoot,
    betaRoot,
    manifestBaseUrl,
    privateKey: keyPair.privateKey
  });
  buildManualValidationInstaller({
    publicKeyPem,
    manifestBaseUrl,
    stableSeedBundlePath,
    installerOutputRoot
  });

  const packagedDmgPath = findFirstDmg(installerOutputRoot);
  if (!packagedDmgPath) {
    throw new Error(`Unable to find packaged dmg under ${installerOutputRoot}`);
  }
  copyFileSync(packagedDmgPath, installerDmgPath);
  const startServerScript = finalizeManualValidationSupport({
    supportRoot,
    port,
    installerDmgPath,
    stableVersion,
    betaVersion
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        installerDmgPath,
        supportRoot,
        stableVersion,
        betaVersion,
        startServerScript
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  console.error(`[prepare-manual-update-validation] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
