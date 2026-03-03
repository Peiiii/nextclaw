import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

function run(command, args) {
  execFileSync(command, args, { stdio: "pipe" });
}

function createIcoFromPng(pngBuffer) {
  const header = Buffer.alloc(6 + 16);
  // ICONDIR
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(1, 4); // one image
  // ICONDIRENTRY
  header.writeUInt8(0, 6); // 0 means 256px
  header.writeUInt8(0, 7); // 0 means 256px
  header.writeUInt8(0, 8); // palette
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // color planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(pngBuffer.length, 14);
  header.writeUInt32LE(6 + 16, 18);
  return Buffer.concat([header, pngBuffer]);
}

const appRoot = resolve(import.meta.dirname, "..");
const sourceSvg = resolve(appRoot, "..", "landing", "public", "logo.svg");
const iconsOutputDir = resolve(appRoot, "build", "icons");

if (!existsSync(sourceSvg)) {
  throw new Error(`Source logo not found: ${sourceSvg}`);
}

const tempDir = mkdtempSync(join(tmpdir(), "nextclaw-desktop-icon-"));
const iconsetDir = join(tempDir, "icon.iconset");
const quickLookPng = join(tempDir, `${basename(sourceSvg)}.png`);

mkdirSync(iconsetDir, { recursive: true });
mkdirSync(iconsOutputDir, { recursive: true });

try {
  run("qlmanage", ["-t", "-s", "1024", "-o", tempDir, sourceSvg]);
  if (!existsSync(quickLookPng)) {
    throw new Error(`Quick Look did not render PNG: ${quickLookPng}`);
  }

  const iconSizes = [
    ["icon_16x16.png", 16],
    ["icon_16x16@2x.png", 32],
    ["icon_32x32.png", 32],
    ["icon_32x32@2x.png", 64],
    ["icon_128x128.png", 128],
    ["icon_128x128@2x.png", 256],
    ["icon_256x256.png", 256],
    ["icon_256x256@2x.png", 512],
    ["icon_512x512.png", 512],
    ["icon_512x512@2x.png", 1024]
  ];

  for (const [name, size] of iconSizes) {
    run("sips", ["-z", String(size), String(size), quickLookPng, "--out", join(iconsetDir, name)]);
  }

  const icnsPath = join(iconsOutputDir, "icon.icns");
  run("iconutil", ["-c", "icns", iconsetDir, "-o", icnsPath]);

  const png256Path = join(iconsetDir, "icon_256x256.png");
  const icoPath = join(iconsOutputDir, "icon.ico");
  const pngPath = join(iconsOutputDir, "icon.png");
  const png256Buffer = readFileSync(png256Path);
  writeFileSync(icoPath, createIcoFromPng(png256Buffer));
  copyFileSync(join(iconsetDir, "icon_512x512.png"), pngPath);

  console.log(`Generated desktop icons at: ${iconsOutputDir}`);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
