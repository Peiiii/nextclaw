const defaultDesktopMetadataUrl =
  'https://raw.githubusercontent.com/Peiiii/nextclaw/gh-pages/desktop-downloads/stable.json';
const stableDesktopManifestUrl =
  'https://raw.githubusercontent.com/Peiiii/nextclaw/gh-pages/desktop-updates/stable/manifest-stable-win32-x64.json';
const desktopMetadataSchema = 'nextclaw.desktop-download/v1';
const desktopReleaseTagPattern = /^v\d+\.\d+\.\d+-desktop\.\d+$/;
const desktopVersionPattern = /^\d+\.\d+\.\d+$/;

type PagesFunctionContext = {
  env?: {
    DESKTOP_RELEASE_METADATA_URL?: string;
  };
  request: Request;
};

type CloudflareRequestInit = RequestInit & {
  cf?: {
    cacheEverything: boolean;
    cacheTtl: number;
  };
};

const upstreamRequestInit: CloudflareRequestInit = {
  redirect: 'follow',
  cf: {
    cacheEverything: true,
    cacheTtl: 300
  }
};

export async function onRequestGet(_context: PagesFunctionContext): Promise<Response> {
  try {
    const metadataUrl = _context.env?.DESKTOP_RELEASE_METADATA_URL ?? defaultDesktopMetadataUrl;
    const metadataResponse = await fetch(metadataUrl, upstreamRequestInit);
    let metadata: unknown;
    if (metadataResponse.status === 404 && metadataUrl === defaultDesktopMetadataUrl) {
      metadata = await resolveBootstrapDesktopMetadata();
    } else if (!metadataResponse.ok) {
      throw new Error(`Desktop metadata returned ${metadataResponse.status}.`);
    } else {
      metadata = await metadataResponse.json();
    }

    return Response.json(resolveDesktopReleaseInfo(metadata), {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400'
      }
    });
  } catch (error) {
    console.error('Failed to resolve the latest desktop release.', error);
    return Response.json(
      { error: 'Latest desktop release is temporarily unavailable.' },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  }
}

async function resolveBootstrapDesktopMetadata() {
  const manifestResponse = await fetch(stableDesktopManifestUrl, upstreamRequestInit);
  if (!manifestResponse.ok) {
    throw new Error(`Stable desktop manifest returned ${manifestResponse.status}.`);
  }
  const manifest = (await manifestResponse.json()) as Record<string, unknown>;
  const bundleUrl = typeof manifest.bundleUrl === 'string' ? manifest.bundleUrl : '';
  const releaseTag = new URL(bundleUrl).pathname.match(/\/releases\/download\/(v\d+\.\d+\.\d+-desktop\.\d+)\//)?.[1] ?? '';
  if (manifest.channel !== 'stable' || !desktopReleaseTagPattern.test(releaseTag)) {
    throw new Error('Stable desktop manifest identity is invalid.');
  }

  const updateMetadataUrl = `https://github.com/Peiiii/nextclaw/releases/download/${releaseTag}/latest.yml`;
  const updateMetadataResponse = await fetch(updateMetadataUrl, upstreamRequestInit);
  if (!updateMetadataResponse.ok) {
    throw new Error(`Desktop update metadata returned ${updateMetadataResponse.status}.`);
  }
  const updateMetadata = await updateMetadataResponse.text();
  const version = updateMetadata.match(/^version:\s*['"]?([^'"\s]+)['"]?\s*$/m)?.[1] ?? '';
  const installerPath = updateMetadata.match(/^path:\s*['"]?([^'"\r\n]+)['"]?\s*$/m)?.[1]?.trim() ?? '';
  if (!desktopVersionPattern.test(version) || installerPath !== `NextClaw.Desktop-Setup-${version}-x64.exe`) {
    throw new Error('Desktop update metadata identity is invalid.');
  }
  return { schema: desktopMetadataSchema, tag: releaseTag, version };
}

function resolveDesktopReleaseInfo(input: unknown) {
  if (!input || typeof input !== 'object') {
    throw new Error('Desktop metadata is not an object.');
  }
  const metadata = input as Record<string, unknown>;
  const tag = typeof metadata.tag === 'string' ? metadata.tag : '';
  const version = typeof metadata.version === 'string' ? metadata.version : '';
  if (metadata.schema !== desktopMetadataSchema || !desktopReleaseTagPattern.test(tag) || !desktopVersionPattern.test(version)) {
    throw new Error('Desktop metadata identity is invalid.');
  }
  const releasePageUrl = `https://github.com/Peiiii/nextclaw/releases/tag/${tag}`;
  const assetBaseUrl = `https://github.com/Peiiii/nextclaw/releases/download/${tag}`;
  const expectedInstallerPath = `NextClaw.Desktop-Setup-${version}-x64.exe`;
  return {
    tag,
    version,
    url: releasePageUrl,
    assets: {
      macArm64Dmg: `${assetBaseUrl}/NextClaw.Desktop-${version}-arm64.dmg`,
      macX64Dmg: `${assetBaseUrl}/NextClaw.Desktop-${version}-x64.dmg`,
      windowsX64Installer: `${assetBaseUrl}/${expectedInstallerPath}`,
      linuxX64AppImage: `${assetBaseUrl}/NextClaw.Desktop-${version}-linux-x64.AppImage`
    },
    windowsPortableZipUrl: `${assetBaseUrl}/NextClaw-Portable-${version}-win-x64.zip`
  };
}
