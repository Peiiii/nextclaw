const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { notarize } = require("@electron/notarize");

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

function readCodesignDetails(appPath) {
  try {
    return execFileSync("codesign", ["-dv", "--verbose=4", appPath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    const stdout = typeof error?.stdout === "string" ? error.stdout : "";
    const stderr = typeof error?.stderr === "string" ? error.stderr : "";
    return `${stdout}${stderr}`.trim();
  }
}

function verifyBundleSignature(appPath) {
  try {
    execFileSync("codesign", ["--verify", "--deep", "--strict", "--verbose=4", appPath], {
      stdio: ["ignore", "pipe", "pipe"]
    });
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

function ensureUsableMacBundleSignature(appPath) {
  const verification = verifyBundleSignature(appPath);
  const details = readCodesignDetails(appPath);
  const looksIncompleteAdhoc =
    details.includes("Signature=adhoc")
    || details.includes("TeamIdentifier=not set")
    || details.includes("Sealed Resources=none")
    || details.includes("Info.plist=not bound");

  if (verification.ok && !looksIncompleteAdhoc) {
    console.log("[desktop-after-sign] keeping existing macOS bundle signature.");
    return;
  }

  if (!verification.ok) {
    console.warn(
      `[desktop-after-sign] bundle signature verification failed; rebuilding adhoc signature.\n${verification.output}`
    );
  } else {
    console.warn(
      "[desktop-after-sign] bundle only has a partial/adhoc executable signature; rebuilding full adhoc bundle signature."
    );
  }

  execFileSync("codesign", ["--force", "--deep", "--sign", "-", "--timestamp=none", appPath], {
    stdio: "inherit"
  });

  const repaired = verifyBundleSignature(appPath);
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

  ensureUsableMacBundleSignature(appPath);

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
