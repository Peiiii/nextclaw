import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { getDataDir } from "@nextclaw/core";

const REMOTE_BRIDGE_DIR = join(getDataDir(), "remote");
const REMOTE_BRIDGE_SECRET_PATH = join(REMOTE_BRIDGE_DIR, "ui-bridge-secret");

export function getUiBridgeSecretPath(): string {
  return REMOTE_BRIDGE_SECRET_PATH;
}

export function readUiBridgeSecret(): string | null {
  if (!existsSync(REMOTE_BRIDGE_SECRET_PATH)) {
    return null;
  }
  try {
    const raw = readFileSync(REMOTE_BRIDGE_SECRET_PATH, "utf-8").trim();
    return raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export function ensureUiBridgeSecret(): string {
  const existing = readUiBridgeSecret();
  if (existing) {
    return existing;
  }
  mkdirSync(REMOTE_BRIDGE_DIR, { recursive: true });
  const secret = randomBytes(24).toString("hex");
  writeFileSync(REMOTE_BRIDGE_SECRET_PATH, `${secret}\n`, "utf-8");
  return secret;
}
