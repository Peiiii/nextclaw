export type DownloadAssetKey = 'macArm64Dmg' | 'macX64Dmg' | 'windowsX64Installer' | 'linuxX64AppImage';

export type DesktopReleaseInfo = {
  tag: string;
  version: string;
  url: string;
  assets: Record<DownloadAssetKey, string>;
  windowsPortableZipUrl: string | null;
};

const STABLE_DESKTOP_RELEASE_TAG = 'v0.57.0-desktop.1';
const STABLE_DESKTOP_VERSION = '0.0.296';
const STABLE_DESKTOP_RELEASE_URL = `https://github.com/Peiiii/nextclaw/releases/tag/${STABLE_DESKTOP_RELEASE_TAG}`;
const STABLE_DESKTOP_ASSET_BASE_URL = `https://github.com/Peiiii/nextclaw/releases/download/${STABLE_DESKTOP_RELEASE_TAG}`;
const STABLE_DESKTOP_RELEASE_METADATA_URL = '/api/desktop-release';
const STABLE_DESKTOP_RELEASE_TAG_PATTERN = /^v\d+\.\d+\.\d+-desktop\.\d+$/;
const DESKTOP_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export const DESKTOP_RELEASE_FALLBACK: DesktopReleaseInfo = {
  tag: STABLE_DESKTOP_RELEASE_TAG,
  version: STABLE_DESKTOP_VERSION,
  url: STABLE_DESKTOP_RELEASE_URL,
  assets: {
    macArm64Dmg: `${STABLE_DESKTOP_ASSET_BASE_URL}/NextClaw.Desktop-${STABLE_DESKTOP_VERSION}-arm64.dmg`,
    macX64Dmg: `${STABLE_DESKTOP_ASSET_BASE_URL}/NextClaw.Desktop-${STABLE_DESKTOP_VERSION}-x64.dmg`,
    windowsX64Installer: `${STABLE_DESKTOP_ASSET_BASE_URL}/NextClaw.Desktop-Setup-${STABLE_DESKTOP_VERSION}-x64.exe`,
    linuxX64AppImage: `${STABLE_DESKTOP_ASSET_BASE_URL}/NextClaw.Desktop-${STABLE_DESKTOP_VERSION}-linux-x64.AppImage`
  },
  windowsPortableZipUrl: `${STABLE_DESKTOP_ASSET_BASE_URL}/NextClaw-Portable-${STABLE_DESKTOP_VERSION}-win-x64.zip`
};

function readRequiredString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function resolveDesktopReleaseInfo(input: unknown): DesktopReleaseInfo | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const release = input as Record<string, unknown>;
  const tag = readRequiredString(release, 'tag');
  const version = readRequiredString(release, 'version');
  const url = readRequiredString(release, 'url');
  if (!tag || !STABLE_DESKTOP_RELEASE_TAG_PATTERN.test(tag) || !version || !DESKTOP_VERSION_PATTERN.test(version) || !url) {
    return null;
  }

  if (!release.assets || typeof release.assets !== 'object' || Array.isArray(release.assets)) {
    return null;
  }
  const assets = release.assets as Record<string, unknown>;
  const macArm64Dmg = readRequiredString(assets, 'macArm64Dmg');
  const macX64Dmg = readRequiredString(assets, 'macX64Dmg');
  const windowsX64Installer = readRequiredString(assets, 'windowsX64Installer');
  const linuxX64AppImage = readRequiredString(assets, 'linuxX64AppImage');

  if (!macArm64Dmg || !macX64Dmg || !windowsX64Installer || !linuxX64AppImage) {
    return null;
  }

  const windowsPortableZipUrl =
    release.windowsPortableZipUrl === null ? null : readRequiredString(release, 'windowsPortableZipUrl');

  return {
    tag,
    version,
    url,
    assets: {
      macArm64Dmg,
      macX64Dmg,
      windowsX64Installer,
      linuxX64AppImage
    },
    windowsPortableZipUrl
  };
}

export async function fetchLatestStableDesktopRelease(): Promise<DesktopReleaseInfo | null> {
  try {
    const response = await fetch(STABLE_DESKTOP_RELEASE_METADATA_URL, {
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      return null;
    }

    return resolveDesktopReleaseInfo(await response.json());
  } catch (error) {
    console.warn('Failed to fetch desktop release metadata', error);
  }

  return null;
}

export function detectRecommendedDesktopAsset(): DownloadAssetKey | 'unknown' {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes('windows')) {
    return 'windowsX64Installer';
  }

  if (userAgent.includes('linux') && !userAgent.includes('android')) {
    return 'linuxX64AppImage';
  }

  const userAgentData = (navigator as Navigator & { userAgentData?: { architecture?: string; platform?: string } }).userAgentData;
  if (userAgentData?.platform?.toLowerCase() === 'macos') {
    const arch = userAgentData.architecture?.toLowerCase();
    if (arch === 'arm' || arch === 'arm64' || arch === 'aarch64') {
      return 'macArm64Dmg';
    }
    if (arch === 'x86' || arch === 'x86_64' || arch === 'x64') {
      return 'macX64Dmg';
    }
  }

  return 'unknown';
}
