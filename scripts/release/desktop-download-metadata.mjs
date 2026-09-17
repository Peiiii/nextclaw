import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const DESKTOP_DOWNLOAD_METADATA_SCHEMA = "nextclaw.desktop-download/v1";

const stableDesktopTagPattern = /^v\d+\.\d+\.\d+-desktop\.\d+$/u;
const desktopVersionPattern = /^\d+\.\d+\.\d+$/u;

export function buildDesktopDownloadMetadata({ tag, version }) {
  if (!stableDesktopTagPattern.test(tag)) {
    throw new Error(`Stable desktop release tag is invalid: ${tag}`);
  }
  if (!desktopVersionPattern.test(version)) {
    throw new Error(`Desktop version is invalid: ${version}`);
  }

  const releaseUrl = `https://github.com/Peiiii/nextclaw/releases/tag/${tag}`;
  const assetBaseUrl = `https://github.com/Peiiii/nextclaw/releases/download/${tag}`;
  return {
    schema: DESKTOP_DOWNLOAD_METADATA_SCHEMA,
    tag,
    version,
    url: releaseUrl,
    assets: {
      macArm64Dmg: `${assetBaseUrl}/NextClaw.Desktop-${version}-arm64.dmg`,
      macX64Dmg: `${assetBaseUrl}/NextClaw.Desktop-${version}-x64.dmg`,
      windowsX64Installer: `${assetBaseUrl}/NextClaw.Desktop-Setup-${version}-x64.exe`,
      linuxX64AppImage: `${assetBaseUrl}/NextClaw.Desktop-${version}-linux-x64.AppImage`
    },
    windowsPortableZipUrl: `${assetBaseUrl}/NextClaw-Portable-${version}-win-x64.zip`
  };
}

function readOption(args, name) {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : "";
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing required option: ${name}`);
  }
  return value;
}

async function main(args) {
  const tag = readOption(args, "--tag");
  const desktopPackagePath = readOption(args, "--desktop-package");
  const outputPath = readOption(args, "--output");
  const desktopPackage = JSON.parse(await readFile(desktopPackagePath, "utf8"));
  const metadata = buildDesktopDownloadMetadata({ tag, version: desktopPackage.version });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(metadata, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
