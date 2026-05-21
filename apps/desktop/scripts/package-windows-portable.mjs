#!/usr/bin/env node
import JSZip from "jszip";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { cp, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = resolve(desktopDir, "release");
const packageJson = JSON.parse(readFileSync(resolve(desktopDir, "package.json"), "utf8"));
const version = String(packageJson.version ?? "").trim();

function readArgValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index < 0) {
    return fallback;
  }
  const value = process.argv[index + 1]?.trim();
  if (!value) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function normalizeArch(value) {
  if (value === "x64" || value === "arm64") {
    return value;
  }
  throw new Error(`Unsupported Windows portable arch: ${value}`);
}

function resolveUnpackedDir(arch) {
  const explicitInput = readArgValue("--input-dir");
  if (explicitInput) {
    return resolve(explicitInput);
  }
  return resolve(releaseDir, arch === "arm64" ? "win-arm64-unpacked" : "win-unpacked");
}

function walkFiles(rootDir) {
  const files = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (stat.isFile()) {
        files.push(fullPath);
      }
    }
  };
  visit(rootDir);
  return files;
}

async function zipDirectory(sourceDir, outputPath) {
  const zip = new JSZip();
  for (const filePath of walkFiles(sourceDir)) {
    const relativePath = relative(sourceDir, filePath).replace(/\\/g, "/");
    zip.file(relativePath, readFileSync(filePath));
  }
  const bytes = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 }
  });
  writeFileSync(outputPath, bytes);
}

async function packagePortable() {
  if (!version) {
    throw new Error("Desktop package version is missing.");
  }
  const arch = normalizeArch(readArgValue("--arch", process.arch === "arm64" ? "arm64" : "x64"));
  const unpackedDir = resolveUnpackedDir(arch);
  if (!existsSync(unpackedDir)) {
    throw new Error(`Windows unpacked desktop directory not found: ${unpackedDir}`);
  }

  const stagingRoot = resolve(releaseDir, `portable-${arch}-staging`);
  const portableRoot = join(stagingRoot, "NextClaw-Portable");
  const outputPath = resolve(
    readArgValue("--output", join(releaseDir, `NextClaw-Portable-${version}-win-${arch}.zip`))
  );

  rmSync(stagingRoot, { recursive: true, force: true });
  mkdirSync(portableRoot, { recursive: true });
  await cp(unpackedDir, portableRoot, {
    recursive: true,
    filter: (source) => basename(source) !== "debug.log"
  });
  await writeFile(
    join(portableRoot, "nextclaw-portable.json"),
    `${JSON.stringify({ kind: "nextclaw-portable", version: 1 }, null, 2)}\n`,
    "utf8"
  );

  rmSync(outputPath, { force: true });
  await zipDirectory(stagingRoot, outputPath);
  rmSync(stagingRoot, { recursive: true, force: true });
  console.log(`[desktop-portable] wrote ${outputPath}`);
}

await packagePortable();
