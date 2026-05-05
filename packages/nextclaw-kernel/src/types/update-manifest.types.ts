export type UpdateHostKind = "desktop-bundle" | "npm-runtime-bundle";

export type UnsignedUpdateManifest = {
  channel: string;
  platform: string;
  arch: string;
  hostKind?: UpdateHostKind;
  latestVersion: string;
  minimumLauncherVersion: string;
  bundleUrl: string;
  bundleSha256: string;
  bundleSignature: string;
  releaseNotesUrl: string | null;
};

export type UpdateManifest = UnsignedUpdateManifest & {
  manifestSignature: string;
};

function readRequiredString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${context} missing required string field: ${key}`);
  }
  return value.trim();
}

export function getUnsignedUpdateManifest(manifest: UpdateManifest | UnsignedUpdateManifest): UnsignedUpdateManifest {
  return {
    channel: manifest.channel,
    platform: manifest.platform,
    arch: manifest.arch,
    hostKind: manifest.hostKind,
    latestVersion: manifest.latestVersion,
    minimumLauncherVersion: manifest.minimumLauncherVersion,
    bundleUrl: manifest.bundleUrl,
    bundleSha256: manifest.bundleSha256,
    bundleSignature: manifest.bundleSignature,
    releaseNotesUrl: manifest.releaseNotesUrl
  };
}

export function serializeUnsignedUpdateManifest(manifest: UpdateManifest | UnsignedUpdateManifest): string {
  return JSON.stringify(getUnsignedUpdateManifest(manifest));
}

export class UpdateManifestReader {
  parse = (input: unknown, context = "update manifest"): UpdateManifest => {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error(`${context} must be an object`);
    }
    const record = input as Record<string, unknown>;
    const hostKind = typeof record.hostKind === "string" && record.hostKind.trim()
      ? this.readHostKind(record.hostKind.trim(), context)
      : undefined;
    const releaseNotesUrl =
      typeof record.releaseNotesUrl === "string" && record.releaseNotesUrl.trim() ? record.releaseNotesUrl.trim() : null;

    return {
      channel: readRequiredString(record, "channel", context),
      platform: readRequiredString(record, "platform", context),
      arch: readRequiredString(record, "arch", context),
      hostKind,
      latestVersion: readRequiredString(record, "latestVersion", context),
      minimumLauncherVersion: readRequiredString(record, "minimumLauncherVersion", context),
      bundleUrl: readRequiredString(record, "bundleUrl", context),
      bundleSha256: readRequiredString(record, "bundleSha256", context).toLowerCase(),
      bundleSignature: readRequiredString(record, "bundleSignature", context),
      releaseNotesUrl,
      manifestSignature: readRequiredString(record, "manifestSignature", context)
    };
  };

  private readHostKind = (value: string, context: string): UpdateHostKind => {
    if (value === "desktop-bundle" || value === "npm-runtime-bundle") {
      return value;
    }
    throw new Error(`${context} has unsupported hostKind: ${value}`);
  };
}
