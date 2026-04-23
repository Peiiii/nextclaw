export type DownloadAssetKey = 'macArm64Dmg' | 'macX64Dmg' | 'windowsX64Installer' | 'linuxX64AppImage';

export type DesktopReleaseInfo = {
  tag: string;
  version: string;
  url: string;
  assets: Record<DownloadAssetKey, string>;
  windowsPortableZipUrl: string | null;
};

export const DESKTOP_RELEASE_FALLBACK: DesktopReleaseInfo = {
  tag: 'v0.18.4-desktop.1',
  version: '0.0.147',
  url: 'https://github.com/Peiiii/nextclaw/releases/tag/v0.18.4-desktop.1',
  assets: {
    macArm64Dmg:
      'https://github.com/Peiiii/nextclaw/releases/download/v0.18.4-desktop.1/NextClaw.Desktop-0.0.147-arm64.dmg',
    macX64Dmg:
      'https://github.com/Peiiii/nextclaw/releases/download/v0.18.4-desktop.1/NextClaw.Desktop-0.0.147-x64.dmg',
    windowsX64Installer:
      'https://github.com/Peiiii/nextclaw/releases/download/v0.18.4-desktop.1/NextClaw.Desktop-Setup-0.0.147-x64.exe',
    linuxX64AppImage:
      'https://github.com/Peiiii/nextclaw/releases/download/v0.18.4-desktop.1/NextClaw.Desktop-0.0.147-linux-x64.AppImage'
  },
  windowsPortableZipUrl:
    'https://github.com/Peiiii/nextclaw/releases/download/v0.18.4-desktop.1/NextClaw.Desktop-0.0.147-win32-x64-unpacked.zip'
};

const GITHUB_RELEASES_API = 'https://api.github.com/repos/Peiiii/nextclaw/releases?per_page=20';

const DESKTOP_ASSET_PATTERNS: Record<DownloadAssetKey, RegExp> = {
  macArm64Dmg: /NextClaw\.Desktop-(\d+\.\d+\.\d+)-arm64\.dmg$/,
  macX64Dmg: /NextClaw\.Desktop-(\d+\.\d+\.\d+)(?:-x64)?\.dmg$/,
  windowsX64Installer: /NextClaw\.Desktop-Setup-(\d+\.\d+\.\d+)-x64\.exe$/,
  linuxX64AppImage: /NextClaw(?:\.Desktop| Desktop)-(\d+\.\d+\.\d+)(?:-linux-x64)?\.AppImage$/i
};

const WINDOWS_PORTABLE_ZIP_PATTERN = /NextClaw\.Desktop(?:-(\d+\.\d+\.\d+))?-win32-x64-unpacked\.zip$/;

function inferDesktopVersionFromAssetName(assetName: string): string | null {
  const match = assetName.match(DESKTOP_ASSET_PATTERNS.macArm64Dmg) ?? assetName.match(DESKTOP_ASSET_PATTERNS.macX64Dmg);
  return match?.[1] ?? null;
}

function resolveDesktopReleaseInfo(input: unknown): DesktopReleaseInfo | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const release = input as {
    draft?: boolean;
    prerelease?: boolean;
    tag_name?: string;
    html_url?: string;
    assets?: Array<{ name?: string; browser_download_url?: string }>;
  };

  if (release.draft || release.prerelease) {
    return null;
  }

  if (typeof release.tag_name !== 'string' || !/^v\d+\.\d+\.\d+-desktop\.\d+$/.test(release.tag_name)) {
    return null;
  }

  const assets = Array.isArray(release.assets) ? release.assets : [];
  const macArmAsset = assets.find((item) => typeof item.name === 'string' && DESKTOP_ASSET_PATTERNS.macArm64Dmg.test(item.name));
  const macX64Asset = assets.find((item) => typeof item.name === 'string' && DESKTOP_ASSET_PATTERNS.macX64Dmg.test(item.name));
  const windowsInstallerAsset = assets.find(
    (item) => typeof item.name === 'string' && DESKTOP_ASSET_PATTERNS.windowsX64Installer.test(item.name)
  );
  const windowsPortableZipAsset = assets.find(
    (item) => typeof item.name === 'string' && WINDOWS_PORTABLE_ZIP_PATTERN.test(item.name)
  );
  const linuxAsset = assets.find(
    (item) => typeof item.name === 'string' && DESKTOP_ASSET_PATTERNS.linuxX64AppImage.test(item.name)
  );

  if (
    !macArmAsset?.browser_download_url ||
    !macX64Asset?.browser_download_url ||
    (!windowsInstallerAsset?.browser_download_url && !windowsPortableZipAsset?.browser_download_url) ||
    !linuxAsset?.browser_download_url ||
    !macArmAsset.name
  ) {
    return null;
  }

  const version = inferDesktopVersionFromAssetName(macArmAsset.name) ?? DESKTOP_RELEASE_FALLBACK.version;

  return {
    tag: release.tag_name,
    version,
    url: release.html_url ?? `https://github.com/Peiiii/nextclaw/releases/tag/${release.tag_name}`,
    assets: {
      macArm64Dmg: macArmAsset.browser_download_url,
      macX64Dmg: macX64Asset.browser_download_url,
      windowsX64Installer: windowsInstallerAsset?.browser_download_url ?? windowsPortableZipAsset?.browser_download_url ?? '',
      linuxX64AppImage: linuxAsset.browser_download_url
    },
    windowsPortableZipUrl: windowsPortableZipAsset?.browser_download_url ?? null
  };
}

export async function fetchLatestStableDesktopRelease(): Promise<DesktopReleaseInfo | null> {
  try {
    const response = await fetch(GITHUB_RELEASES_API, {
      headers: {
        Accept: 'application/vnd.github+json'
      }
    });

    if (!response.ok) {
      return null;
    }

    const releases: unknown = await response.json();
    if (!Array.isArray(releases)) {
      return null;
    }

    for (const candidate of releases) {
      const resolved = resolveDesktopReleaseInfo(candidate);
      if (resolved) {
        return resolved;
      }
    }
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
