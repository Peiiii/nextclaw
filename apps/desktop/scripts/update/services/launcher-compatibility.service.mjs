#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
export const desktopLauncherCompatibilityContractPath = resolve(desktopDir, "desktop-launcher-compatibility.json");

function readRequiredString(record, key, context) {
  const value = record?.[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${context} missing required string field: ${key}`);
  }
  return value.trim();
}

export function normalizeDesktopUpdateChannel(channel) {
  return channel?.trim() === "beta" ? "beta" : "stable";
}

export function readDesktopLauncherCompatibilityContract() {
  const parsed = JSON.parse(readFileSync(desktopLauncherCompatibilityContractPath, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${desktopLauncherCompatibilityContractPath} must be an object`);
  }
  const stable = parsed.stable;
  const beta = parsed.beta;
  return {
    stable: {
      minimumLauncherVersion: readRequiredString(stable, "minimumLauncherVersion", "stable"),
      policy: readRequiredString(stable, "policy", "stable")
    },
    beta: {
      minimumLauncherVersion: readRequiredString(beta, "minimumLauncherVersion", "beta"),
      policy: readRequiredString(beta, "policy", "beta")
    }
  };
}

export function resolveMinimumLauncherVersionForChannel(channel) {
  const normalizedChannel = normalizeDesktopUpdateChannel(channel);
  const contract = readDesktopLauncherCompatibilityContract();
  return contract[normalizedChannel].minimumLauncherVersion;
}

export function resolveGovernedMinimumLauncherVersion(options = {}) {
  const normalizedChannel = normalizeDesktopUpdateChannel(options.channel);
  const explicitMinimumLauncherVersion = options.minimumLauncherVersion?.trim() || "";
  const contractMinimumLauncherVersion = resolveMinimumLauncherVersionForChannel(normalizedChannel);
  if (!explicitMinimumLauncherVersion) {
    return contractMinimumLauncherVersion;
  }
  if (explicitMinimumLauncherVersion === contractMinimumLauncherVersion) {
    return explicitMinimumLauncherVersion;
  }
  if (options.allowOverride) {
    return explicitMinimumLauncherVersion;
  }
  throw new Error(
    [
      `minimum launcher version ${explicitMinimumLauncherVersion} does not match the ${normalizedChannel} channel contract floor ${contractMinimumLauncherVersion}.`,
      `Update ${desktopLauncherCompatibilityContractPath} only when a launcher-side contract break is explicitly approved.`
    ].join(" ")
  );
}
