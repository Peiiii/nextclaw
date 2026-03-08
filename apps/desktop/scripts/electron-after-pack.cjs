const fs = require("node:fs");
const path = require("node:path");

const ARCH_MAP = {
  0: "ia32",
  1: "x64",
  2: "armv7l",
  3: "arm64",
  4: "universal"
};

function resolveArch(archValue) {
  if (typeof archValue === "string" && archValue.trim()) {
    return archValue.trim();
  }
  if (typeof archValue === "number" && Object.prototype.hasOwnProperty.call(ARCH_MAP, archValue)) {
    return ARCH_MAP[archValue];
  }
  return String(archValue ?? "");
}

function existsDir(targetPath) {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function removeDirIfExists(targetPath, removedPaths) {
  if (!existsDir(targetPath)) {
    return;
  }
  fs.rmSync(targetPath, { recursive: true, force: true });
  removedPaths.push(targetPath);
}

function resolveNodeModulesRoots(appOutDir) {
  const resourcesDir = path.join(appOutDir, "Contents", "Resources");
  const windowsResourcesDir = path.join(appOutDir, "resources");
  const roots = [
    path.join(resourcesDir, "app", "node_modules"),
    path.join(resourcesDir, "app.asar.unpacked", "node_modules"),
    path.join(windowsResourcesDir, "app", "node_modules"),
    path.join(windowsResourcesDir, "app.asar.unpacked", "node_modules")
  ];
  return roots.filter((entry, index) => roots.indexOf(entry) === index && existsDir(entry));
}

function shouldKeepPlatformPackage(pkgPlatform, targetPlatform) {
  if (targetPlatform === "darwin") {
    return pkgPlatform === "darwin";
  }
  if (targetPlatform === "win32") {
    return pkgPlatform === "win32";
  }
  if (targetPlatform === "linux") {
    return pkgPlatform === "linux" || pkgPlatform === "linuxmusl";
  }
  return true;
}

function shouldKeepArch(pkgArch, targetArch) {
  if (targetArch === "universal") {
    return pkgArch === "x64" || pkgArch === "arm64";
  }
  return pkgArch === targetArch;
}

function pruneCodexBinaryPackages(nodeModulesRoot, targetPlatform, targetArch, removedPaths) {
  const openAiDir = path.join(nodeModulesRoot, "@openai");
  if (!existsDir(openAiDir)) {
    return;
  }

  for (const entry of fs.readdirSync(openAiDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const match = /^codex-(darwin|linux|win32)-(x64|arm64)$/.exec(entry.name);
    if (!match) {
      continue;
    }
    const pkgPlatform = match[1];
    const pkgArch = match[2];
    if (shouldKeepPlatformPackage(pkgPlatform, targetPlatform) && shouldKeepArch(pkgArch, targetArch)) {
      continue;
    }
    removeDirIfExists(path.join(openAiDir, entry.name), removedPaths);
  }
}

function pruneBundledRuntimeEnginePackages(nodeModulesRoot, removedPaths) {
  removeDirIfExists(
    path.join(nodeModulesRoot, "@nextclaw", "nextclaw-engine-codex-sdk"),
    removedPaths
  );
  removeDirIfExists(
    path.join(nodeModulesRoot, "@nextclaw", "nextclaw-engine-claude-agent-sdk"),
    removedPaths
  );
  removeDirIfExists(path.join(nodeModulesRoot, "@openai", "codex"), removedPaths);
  removeDirIfExists(path.join(nodeModulesRoot, "@openai", "codex-sdk"), removedPaths);
  removeDirIfExists(
    path.join(nodeModulesRoot, "@anthropic-ai", "claude-agent-sdk"),
    removedPaths
  );
}

function pruneSharpBinaryPackages(nodeModulesRoot, targetPlatform, targetArch, removedPaths) {
  const sharpDir = path.join(nodeModulesRoot, "@img");
  if (!existsDir(sharpDir)) {
    return;
  }

  for (const entry of fs.readdirSync(sharpDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const match = /^sharp(?:-libvips)?-(darwin|linux|linuxmusl|win32)-(x64|arm64|arm)$/.exec(entry.name);
    if (!match) {
      continue;
    }
    const pkgPlatform = match[1];
    const pkgArch = match[2];
    if (shouldKeepPlatformPackage(pkgPlatform, targetPlatform) && shouldKeepArch(pkgArch, targetArch)) {
      continue;
    }
    removeDirIfExists(path.join(sharpDir, entry.name), removedPaths);
  }
}

function pruneClaudeRipgrepVendors(nodeModulesRoot, targetPlatform, targetArch, removedPaths) {
  const ripgrepDir = path.join(
    nodeModulesRoot,
    "@anthropic-ai",
    "claude-agent-sdk",
    "vendor",
    "ripgrep"
  );
  if (!existsDir(ripgrepDir)) {
    return;
  }

  for (const entry of fs.readdirSync(ripgrepDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const match = /^(x64|arm64|arm)-(darwin|linux|win32)$/.exec(entry.name);
    if (!match) {
      continue;
    }
    const pkgArch = match[1];
    const pkgPlatform = match[2];
    if (shouldKeepPlatformPackage(pkgPlatform, targetPlatform) && shouldKeepArch(pkgArch, targetArch)) {
      continue;
    }
    removeDirIfExists(path.join(ripgrepDir, entry.name), removedPaths);
  }
}

module.exports = async (context) => {
  const platform = String(context?.electronPlatformName ?? process.platform);
  const arch = resolveArch(context?.arch);
  const appOutDir = String(context?.appOutDir ?? "");

  if (!appOutDir) {
    return;
  }

  const nodeModulesRoots = resolveNodeModulesRoots(appOutDir);
  if (nodeModulesRoots.length === 0) {
    return;
  }

  const removedPaths = [];
  for (const nodeModulesRoot of nodeModulesRoots) {
    pruneBundledRuntimeEnginePackages(nodeModulesRoot, removedPaths);
    pruneCodexBinaryPackages(nodeModulesRoot, platform, arch, removedPaths);
    pruneSharpBinaryPackages(nodeModulesRoot, platform, arch, removedPaths);
    pruneClaudeRipgrepVendors(nodeModulesRoot, platform, arch, removedPaths);
  }

  if (removedPaths.length > 0) {
    console.log(
      `[desktop-after-pack] pruned ${removedPaths.length} platform-mismatched binary directories for ${platform}-${arch}.`
    );
  }
};
