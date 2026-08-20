import { describe, expect, it } from 'vitest';
import {
  getAppMarketplaceInstallabilityRank,
  resolveAppMarketplaceInstallability,
} from '@/features/apps/utils/app-marketplace-platform.utils';

const MAC_TARGET = {
  key: 'darwin-arm64',
  operatingSystem: 'darwin',
  architecture: 'arm64',
} as const;

describe('app marketplace platform compatibility', () => {
  it('treats universal apps as compatible without requiring host target data', () => {
    expect(resolveAppMarketplaceInstallability({
      mode: 'universal',
      targets: [],
      operatingSystems: [],
    }, undefined)).toEqual({ status: 'compatible' });
  });

  it('matches targeted apps by the canonical host target key', () => {
    expect(resolveAppMarketplaceInstallability({
      mode: 'targeted',
      targets: ['darwin-arm64'],
      operatingSystems: ['darwin'],
    }, MAC_TARGET)).toEqual({ status: 'compatible' });
  });

  it('distinguishes unsupported operating systems from unsupported architectures', () => {
    expect(resolveAppMarketplaceInstallability({
      mode: 'targeted',
      targets: ['linux-x64-gnu'],
      operatingSystems: ['linux'],
    }, MAC_TARGET)).toEqual({ status: 'incompatible', reason: 'unsupported-os' });

    expect(resolveAppMarketplaceInstallability({
      mode: 'targeted',
      targets: ['darwin-x64'],
      operatingSystems: ['darwin'],
    }, MAC_TARGET)).toEqual({ status: 'incompatible', reason: 'unsupported-target' });
  });

  it('fails closed when the host target cannot be confirmed', () => {
    const installability = resolveAppMarketplaceInstallability({
      mode: 'targeted',
      targets: ['linux-x64-gnu'],
      operatingSystems: ['linux'],
    }, undefined);

    expect(installability).toEqual({ status: 'unknown' });
    expect(getAppMarketplaceInstallabilityRank(installability)).toBe(1);
    expect(getAppMarketplaceInstallabilityRank({ status: 'compatible' })).toBe(0);
    expect(getAppMarketplaceInstallabilityRank({
      status: 'incompatible',
      reason: 'unsupported-os',
    })).toBe(2);
  });
});
