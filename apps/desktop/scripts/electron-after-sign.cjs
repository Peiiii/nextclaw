const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { notarize } = require("@electron/notarize");
const { signAsync } = require("@electron/osx-sign");

const execFileAsync = promisify(execFile);

function collectNestedAppPaths(rootPath) {
  const results = [];
  const visit = (currentPath) => {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const entryPath = path.join(currentPath, entry.name);
      if (entry.name.endsWith(".app")) {
        results.push(entryPath);
        continue;
      }
      visit(entryPath);
    }
  };
  visit(rootPath);
  return results.sort((left, right) => right.split(path.sep).length - left.split(path.sep).length);
}

function resolveAppleApiKeyFile() {
  const keyPathFromEnv = (process.env.APPLE_API_KEY_PATH || "").trim();
  if (keyPathFromEnv) {
    return { keyPath: keyPathFromEnv, cleanup: null };
  }

  const rawValue = (process.env.APPLE_API_KEY || "").trim();
  if (!rawValue) {
    return { keyPath: "", cleanup: null };
  }

  if (rawValue.includes("BEGIN PRIVATE KEY")) {
    const tmpKeyPath = path.join(
      os.tmpdir(),
      `nextclaw-notary-${Date.now()}-${Math.random().toString(16).slice(2)}.p8`
    );
    fs.writeFileSync(tmpKeyPath, rawValue, { mode: 0o600 });
    return {
      keyPath: tmpKeyPath,
      cleanup: () => {
        fs.rmSync(tmpKeyPath, { force: true });
      }
    };
  }

  return { keyPath: rawValue, cleanup: null };
}

async function verifyBundleSignature(appPath) {
  try {
    await execFileAsync("codesign", ["--verify", "--deep", "--strict", "--verbose=4", appPath]);
    return { ok: true, output: "" };
  } catch (error) {
    const stdout = typeof error?.stdout === "string" ? error.stdout : "";
    const stderr = typeof error?.stderr === "string" ? error.stderr : "";
    return {
      ok: false,
      output: `${stdout}${stderr}`.trim()
    };
  }
}

async function ensureUsableMacBundleSignature(appPath) {
  const verification = await verifyBundleSignature(appPath);

  if (verification.ok) {
    console.log("[desktop-after-sign] keeping existing macOS bundle signature.");
    return;
  }

  console.warn(
    `[desktop-after-sign] bundle signature verification failed; rebuilding Electron adhoc signature.\n${verification.output}`
  );

  const identity = "-";
  console.warn(`[desktop-after-sign] signing macOS bundle with identity: ${identity}`);

  await signAsync({
    app: appPath,
    identity,
    identityValidation: false,
    platform: "darwin",
    type: "development",
    hardenedRuntime: false,
    preAutoEntitlements: false,
    preEmbedProvisioningProfile: false
  });

  const entitlementsPath = path.join(__dirname, "../build/entitlements.mac.plist");
  const inheritEntitlementsPath = path.join(__dirname, "../build/entitlements.mac.inherit.plist");
  for (const nestedAppPath of collectNestedAppPaths(path.join(appPath, "Contents", "Frameworks"))) {
    await execFileAsync("codesign", [
      "--force",
      "--sign",
      identity,
      "--timestamp=none",
      "--entitlements",
      inheritEntitlementsPath,
      nestedAppPath
    ]);
  }
  await execFileAsync("codesign", [
    "--force",
    "--sign",
    identity,
    "--timestamp=none",
    "--entitlements",
    entitlementsPath,
    appPath
  ]);

  const repaired = await verifyBundleSignature(appPath);
  if (!repaired.ok) {
    throw new Error(`failed to prepare usable macOS bundle signature:\n${repaired.output}`);
  }
}

module.exports = async (context) => {
  const platform = String(context?.electronPlatformName || "");
  if (platform !== "darwin") {
    return;
  }

  const appleApiKeyId = (process.env.APPLE_API_KEY_ID || "").trim();
  const appleApiIssuer = (process.env.APPLE_API_ISSUER || "").trim();
  const { keyPath: appleApiKey, cleanup } = resolveAppleApiKeyFile();
  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );

  if (!fs.existsSync(appPath)) {
    console.warn(`[desktop-after-sign] skip notarization: app not found at ${appPath}`);
    return;
  }

  await ensureUsableMacBundleSignature(appPath);

  if (!appleApiKeyId || !appleApiIssuer || !appleApiKey) {
    console.warn(
      "[desktop-after-sign] skip notarization: missing APPLE_API_KEY_ID / APPLE_API_ISSUER / APPLE_API_KEY."
    );
    return;
  }

  console.log(`[desktop-after-sign] notarizing ${appPath}`);
  try {
    await notarize({
      appPath,
      appleApiKey,
      appleApiKeyId,
      appleApiIssuer,
      tool: "notarytool"
    });
    console.log("[desktop-after-sign] notarization completed.");
  } finally {
    if (cleanup) {
      cleanup();
    }
  }
};
