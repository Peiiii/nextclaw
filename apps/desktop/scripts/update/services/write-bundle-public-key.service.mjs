#!/usr/bin/env node
import { createPrivateKey, createPublicKey } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

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

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = resolve(readRequiredOption(args, "output"));
  const privateKey = resolvePrivateKey(args);
  const publicKeyPem = createPublicKey(privateKey).export({ type: "spki", format: "pem" });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, publicKeyPem);
  process.stdout.write(`${outputPath}\n`);
}

try {
  main();
} catch (error) {
  console.error(`[write-bundle-public-key] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
