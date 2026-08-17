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
