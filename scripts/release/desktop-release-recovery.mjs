import { assertDesktopReleaseAssetMetadata, assertDesktopReleaseAssetSet } from "./desktop-release-closure.mjs";
import { readRelease } from "./desktop-release-github.mjs";

function buildTagPrefix(channel, runtimeVersion) {
  return channel === "beta" ? `v${runtimeVersion}-desktop-beta.` : `v${runtimeVersion}-desktop.`;
}

export function readNextDesktopReleaseTag(options, run) {
  const prefix = buildTagPrefix(options.channel, options.runtimeVersion);
  const output = run("git", ["ls-remote", "--tags", "origin", `refs/tags/${prefix}*`]);
  const nextNumber =
    output
      .split("\n")
      .map((line) => line.trim().split(/\s+/)[1] ?? "")
      .map((ref) => ref.replace(/^refs\/tags\//, "").replace(/\^\{\}$/, ""))
      .map((tag) => Number(tag.startsWith(prefix) ? tag.slice(prefix.length) : Number.NaN))
      .filter(Number.isInteger)
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `${prefix}${nextNumber}`;
}

function readLatestTag(options, run) {
  const prefix = buildTagPrefix(options.channel, options.runtimeVersion);
  const output = run("git", ["ls-remote", "--tags", "origin", `refs/tags/${prefix}*`]);
  return output
    .split("\n")
    .map((line) => line.trim().split(/\s+/)[1] ?? "")
    .map((ref) => ref.replace(/^refs\/tags\//, "").replace(/\^\{\}$/, ""))
    .filter((tag) => tag.startsWith(prefix) && Number.isInteger(Number(tag.slice(prefix.length))))
    .sort((left, right) => Number(right.slice(prefix.length)) - Number(left.slice(prefix.length)))[0] ?? null;
}

function stableAptContainsVersion(options, run) {
  if (options.channel !== "stable") return true;
  try {
    const packages = run("curl", ["-fsSL", `https://raw.githubusercontent.com/${options.repo}/gh-pages/apt/dists/stable/main/binary-amd64/Packages?desktopRelease=${Date.now()}`]);
    return packages.includes(`Version: ${options.desktopVersion}`);
  } catch {
    return false;
  }
}

export function inferExistingReleaseRecovery(options, run) {
  const tag = readLatestTag(options, run);
  if (!tag) return;
  const tagTarget = run("git", ["ls-remote", "origin", `refs/tags/${tag}`]).split(/\s+/)[0];
  if (tagTarget !== options.target) return;

  const release = readRelease({ ...options, tag });
  if (release.isDraft || Boolean(release.isPrerelease) !== (options.channel === "beta") || release.targetCommitish !== options.target) return;
  assertDesktopReleaseAssetSet((release.assets ?? []).map((asset) => asset.name), { ...options, tag });
  assertDesktopReleaseAssetMetadata(release.assets ?? [], { ...options, tag });
  if (stableAptContainsVersion(options, run)) {
    console.log(`[desktop:release] inferred completed release ${tag}; verifying closure without republishing.`);
    return { existingReleaseComplete: true, reuseExistingRelease: true, tag };
  } else {
    console.log(`[desktop:release] inferred APT-only recovery for ${tag}; no release identity input required.`);
    return { publishLinuxAptOnly: true, reuseExistingRelease: true, tag };
  }
}

export function inferExistingDesktopDraft(options, run) {
  const tag = readNextDesktopReleaseTag(options, run);
  try {
    const release = readRelease({ ...options, tag });
    if (
      release.isDraft === true &&
      Boolean(release.isPrerelease) === (options.channel === "beta") &&
      release.targetCommitish === options.target
    ) {
      console.log(`[desktop:release] inferred existing hidden Draft ${tag}; reusing the immutable release identity.`);
      return { reuseExistingRelease: true, tag };
    }
  } catch {
    // A missing draft is the normal new-release path. Creation stays with the
    // stable release owner; this recovery helper only recognizes exact matches.
  }
}
