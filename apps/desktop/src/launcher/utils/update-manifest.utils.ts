export type DesktopUnsignedUpdateManifest = {
  channel: string;
  platform: string;
  arch: string;
  latestVersion: string;
  minimumLauncherVersion: string;
  bundleUrl: string;
  bundleSha256: string;
  bundleSignature: string;
  releaseNotesUrl: string | null;
};

export type DesktopUpdateManifest = DesktopUnsignedUpdateManifest & {
  manifestSignature: string;
};

function readRequiredString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${context} missing required string field: ${key}`);
  }
  return value.trim();
}

export function getDesktopUnsignedUpdateManifest(
  manifest: DesktopUpdateManifest | DesktopUnsignedUpdateManifest
): DesktopUnsignedUpdateManifest {
  return {
    channel: manifest.channel,
    platform: manifest.platform,
    arch: manifest.arch,
    latestVersion: manifest.latestVersion,
    minimumLauncherVersion: manifest.minimumLauncherVersion,
    bundleUrl: manifest.bundleUrl,
    bundleSha256: manifest.bundleSha256,
    bundleSignature: manifest.bundleSignature,
    releaseNotesUrl: manifest.releaseNotesUrl
  };
}

export function serializeDesktopUnsignedUpdateManifest(
  manifest: DesktopUpdateManifest | DesktopUnsignedUpdateManifest
): string {
  return JSON.stringify(getDesktopUnsignedUpdateManifest(manifest));
}

export class DesktopUpdateManifestReader {
  parse = (input: unknown, context = "desktop update manifest"): DesktopUpdateManifest => {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error(`${context} must be an object`);
    }
    const record = input as Record<string, unknown>;
    const releaseNotesUrl =
      typeof record.releaseNotesUrl === "string" && record.releaseNotesUrl.trim() ? record.releaseNotesUrl.trim() : null;

    return {
      channel: readRequiredString(record, "channel", context),
      platform: readRequiredString(record, "platform", context),
      arch: readRequiredString(record, "arch", context),
      latestVersion: readRequiredString(record, "latestVersion", context),
      minimumLauncherVersion: readRequiredString(record, "minimumLauncherVersion", context),
      bundleUrl: readRequiredString(record, "bundleUrl", context),
      bundleSha256: readRequiredString(record, "bundleSha256", context).toLowerCase(),
      bundleSignature: readRequiredString(record, "bundleSignature", context),
      releaseNotesUrl,
      manifestSignature: readRequiredString(record, "manifestSignature", context)
    };
  };
}
