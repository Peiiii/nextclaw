import type { AppPackageOperationView } from '@nextclaw/client-sdk';
import { describe, expect, it, vi } from 'vitest';
import { AppPackageOperationSettlementManager } from '@/features/apps/managers/app-package-operation-settlement.manager';

const mocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: mocks }));

function operation(
  id: string,
  overrides: Partial<AppPackageOperationView> = {},
): AppPackageOperationView {
  return {
    id,
    action: 'update',
    appId: 'nextclaw.personal-organizer',
    status: 'succeeded',
    completedSteps: 5,
    totalSteps: 5,
    createdAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:01.000Z',
    completedAt: '2026-08-12T00:00:01.000Z',
    result: {
      appId: 'nextclaw.personal-organizer',
      activeVersion: '0.1.1',
      changed: true,
    },
    ...overrides,
  };
}

describe('AppPackageOperationSettlementManager', () => {
  it('ignores historical terminal operations and settles each new operation once', async () => {
    const reloadByDedupeKeys = vi.fn();
    const refetchPackages = vi.fn(async () => undefined);
    const refetchAppData = vi.fn(async () => undefined);
    const refetchPanels = vi.fn(async () => ({
      data: {
        entries: [
          { id: 'todos', packageId: 'nextclaw.personal-organizer' },
          { id: 'other', packageId: 'nextclaw.other' },
        ],
      },
    }));
    const manager = new AppPackageOperationSettlementManager({
      reloadByDedupeKeys,
    } as never);
    const historical = operation('historical');

    manager.settle({
      isLoaded: true,
      operations: [historical],
      refetchPackages,
      refetchPanels,
      refetchAppData,
    });
    expect(mocks.success).not.toHaveBeenCalled();

    const completed = operation('completed');
    manager.settle({
      isLoaded: true,
      operations: [completed, historical],
      refetchPackages,
      refetchPanels,
      refetchAppData,
    });
    manager.settle({
      isLoaded: true,
      operations: [completed, historical],
      refetchPackages,
      refetchPanels,
      refetchAppData,
    });

    await vi.waitFor(() => {
      expect(refetchPackages).toHaveBeenCalledTimes(1);
      expect(refetchPanels).toHaveBeenCalledTimes(1);
      expect(refetchAppData).toHaveBeenCalledTimes(1);
      expect(reloadByDedupeKeys).toHaveBeenCalledWith(['panel-app:todos']);
    });
    expect(mocks.success).toHaveBeenCalledTimes(1);
  });
});
