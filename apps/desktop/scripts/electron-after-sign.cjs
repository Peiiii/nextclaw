const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { notarize } = require("@electron/notarize");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

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

async function readCodesignDetails(appPath) {
  try {
    const { stdout, stderr } = await execFileAsync("codesign", ["-dv", "--verbose=4", appPath]);
    return `${stdout}${stderr}`.trim();
  } catch (error) {
    const stdout = typeof error?.stdout === "string" ? error.stdout : "";
    const stderr = typeof error?.stderr === "string" ? error.stderr : "";
    return `${stdout}${stderr}`.trim();
  }
}

async function ensureUsableMacBundleSignature(appPath) {
  const verification = await verifyBundleSignature(appPath);
  const details = await readCodesignDetails(appPath);
  const needsAdhocBundleSignature =
    details.includes("Signature=adhoc")
    || details.includes("TeamIdentifier=not set")
    || details.includes("Sealed Resources=none")
    || details.includes("Info.plist=not bound");

  if (verification.ok && !needsAdhocBundleSignature) {
    console.log("[desktop-after-sign] keeping existing macOS bundle signature.");
    return;
  }

  if (!verification.ok) {
    console.warn(
      `[desktop-after-sign] bundle signature verification failed; rebuilding full adhoc bundle signature.\n${verification.output}`
    );
  } else {
    console.warn("[desktop-after-sign] rebuilding complete adhoc bundle signature for unsigned macOS distribution.");
  }

  await execFileAsync("codesign", ["--force", "--deep", "--sign", "-", "--timestamp=none", appPath]);

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
