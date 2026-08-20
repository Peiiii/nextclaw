import type { AppPackageHostTarget } from '@nextclaw/client-sdk';
import type { AppMarketplaceItemView } from '@/features/apps/types/app-marketplace.types';

const OPERATING_SYSTEM_LABELS: Record<'darwin' | 'linux' | 'win32', string> = {
  darwin: 'macOS',
  linux: 'Linux',
  win32: 'Windows',
};

export function formatAppMarketplacePlatforms(
  availability: AppMarketplaceItemView['availability'],
  universalLabel: string,
): string {
  if (!availability || availability.mode === 'universal') {
    return universalLabel;
  }
  return availability.operatingSystems
    .map((operatingSystem) => OPERATING_SYSTEM_LABELS[operatingSystem])
    .join(' · ');
}

export type AppMarketplaceInstallability =
  | { status: 'compatible' }
  | { status: 'incompatible'; reason: 'unsupported-os' | 'unsupported-target' }
  | { status: 'unknown' };

export function resolveAppMarketplaceInstallability(
  availability: AppMarketplaceItemView['availability'],
  hostTarget: AppPackageHostTarget | undefined,
): AppMarketplaceInstallability {
  if (!availability || availability.mode === 'universal') {
    return { status: 'compatible' };
  }
  if (!hostTarget) {
    return { status: 'unknown' };
  }
  if (availability.targets.includes(hostTarget.key)) {
    return { status: 'compatible' };
  }
  if (!availability.operatingSystems.includes(hostTarget.operatingSystem)) {
    return { status: 'incompatible', reason: 'unsupported-os' };
  }
  return { status: 'incompatible', reason: 'unsupported-target' };
}

export function getAppMarketplaceInstallabilityRank(
  installability: AppMarketplaceInstallability,
): number {
  if (installability.status === 'compatible') return 0;
  if (installability.status === 'unknown') return 1;
  return 2;
}
