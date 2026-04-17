#!/usr/bin/env node
import { createHash, createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { normalizeDesktopUpdateChannel, resolveGovernedMinimumLauncherVersion } from "./launcher-compatibility.service.mjs";

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

function readRequiredOption(args, key) {
  const value = args[key]?.trim();
  if (!value) {
    throw new Error(`Missing required option --${key}`);
  }
  return value;
}

function normalizePem(value) {
  return value.replaceAll("\\n", "\n");
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

function resolvePrivateKey(args) {
  const inlineKey = args["private-key"]?.trim() || process.env.NEXTCLAW_DESKTOP_BUNDLE_PRIVATE_KEY?.trim();
  if (inlineKey) {
    return createPrivateKey(normalizePem(inlineKey));
  }

  const privateKeyPath =
    args["private-key-file"]?.trim() || process.env.NEXTCLAW_DESKTOP_BUNDLE_PRIVATE_KEY_FILE?.trim();
  if (privateKeyPath) {
    return createPrivateKey(readFileSync(resolve(privateKeyPath), "utf8"));
  }

  throw new Error(
    "Missing bundle signing key. Provide --private-key, --private-key-file, NEXTCLAW_DESKTOP_BUNDLE_PRIVATE_KEY, or NEXTCLAW_DESKTOP_BUNDLE_PRIVATE_KEY_FILE."
  );
}

function buildManifest(args) {
  const bundlePath = resolve(readRequiredOption(args, "bundle"));
  const bundleBytes = readFileSync(bundlePath);
  const privateKey = resolvePrivateKey(args);
  const bundleSha256 = createHash("sha256").update(bundleBytes).digest("hex");
  const bundleSignature = sign(null, bundleBytes, privateKey).toString("base64");
  const channel = normalizeDesktopUpdateChannel(args.channel);

  const manifest = {
    channel,
    platform: readRequiredOption(args, "platform"),
    arch: readRequiredOption(args, "arch"),
    latestVersion: readRequiredOption(args, "version"),
    minimumLauncherVersion: resolveGovernedMinimumLauncherVersion({
      channel,
      minimumLauncherVersion: args["minimum-launcher-version"],
      allowOverride: args["allow-minimum-launcher-version-override"] === "true"
    }),
    bundleUrl: readRequiredOption(args, "bundle-url"),
    bundleSha256,
    bundleSignature,
    releaseNotesUrl: args["release-notes-url"]?.trim() || null
  };

  return {
    ...manifest,
    manifestSignature: sign(null, Buffer.from(serializeUnsignedManifest(manifest)), privateKey).toString("base64")
  };
}

function writeJson(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args["print-example"] === "true") {
    const keyPair = generateKeyPairSync("ed25519");
    process.stdout.write(
      [
        "# Example public key for NEXTCLAW_DESKTOP_BUNDLE_PUBLIC_KEY",
        keyPair.publicKey.export({ type: "spki", format: "pem" }).toString(),
        "# Example private key for NEXTCLAW_DESKTOP_BUNDLE_PRIVATE_KEY",
        keyPair.privateKey.export({ type: "pkcs8", format: "pem" }).toString()
      ].join("\n")
    );
    return;
  }

  const outputPath = resolve(readRequiredOption(args, "output"));
  const manifest = buildManifest(args);
  writeJson(outputPath, manifest);
  process.stdout.write(`${outputPath}\n`);
}

try {
  main();
} catch (error) {
  console.error(`[build-update-manifest] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
