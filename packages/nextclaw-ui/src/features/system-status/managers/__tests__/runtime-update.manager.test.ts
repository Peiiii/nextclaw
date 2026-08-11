import type { UpdateSnapshot } from '@nextclaw/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RuntimeUpdateManager } from '@/features/system-status/managers/runtime-update.manager';
import { useRuntimeUpdateStore } from '@/features/system-status/stores/runtime-update.store';

const mocks = vi.hoisted(() => ({
  applyRuntimeUpdate: vi.fn(),
  checkRuntimeUpdate: vi.fn(),
  downloadRuntimeUpdate: vi.fn(),
  fetchRuntimeUpdate: vi.fn(),
  updateRuntimeUpdateChannel: vi.fn()
}));

vi.mock('@/shared/lib/api', () => mocks);

const createSnapshot = (patch: Partial<UpdateSnapshot> = {}): UpdateSnapshot => ({
  status: 'update-available',
  installationKind: 'npm-runtime-bundle',
  channel: 'stable',
  hostVersion: '0.30.0',
  currentVersion: '0.30.0',
  availableVersion: '0.31.0',
  downloadedVersion: null,
  minimumHostVersion: null,
  releaseNotesUrl: null,
  lastCheckedAt: null,
  progress: null,
  canApplyInApp: false,
  requiresRestart: false,
  blockReason: null,
  recoveryCommand: null,
  errorMessage: null,
  ...patch
});

describe('RuntimeUpdateManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeUpdateStore.setState({
      supported: false,
      initialized: false,
      busyAction: null,
      snapshot: null
    });
    mocks.fetchRuntimeUpdate.mockResolvedValue(createSnapshot());
  });

  it('downloads and applies an available update from one user action', async () => {
    const downloaded = createSnapshot({
      status: 'downloaded',
      downloadedVersion: '0.31.0',
      canApplyInApp: true
    });
    const applied = createSnapshot({
      status: 'restart-required',
      availableVersion: null,
      downloadedVersion: null,
      requiresRestart: true
    });
    mocks.downloadRuntimeUpdate.mockResolvedValue(downloaded);
    mocks.applyRuntimeUpdate.mockResolvedValue(applied);
    const manager = new RuntimeUpdateManager();
    await manager.start();

    await manager.updateNow();

    expect(mocks.downloadRuntimeUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.applyRuntimeUpdate).toHaveBeenCalledTimes(1);
    expect(useRuntimeUpdateStore.getState()).toMatchObject({
      busyAction: null,
      snapshot: applied
    });
    manager.stop();
  });

  it('resumes a downloaded update without downloading it again', async () => {
    const downloaded = createSnapshot({
      status: 'downloaded',
      downloadedVersion: '0.31.0',
      canApplyInApp: true
    });
    const applied = createSnapshot({
      status: 'restart-required',
      availableVersion: null,
      downloadedVersion: null,
      requiresRestart: true
    });
    mocks.fetchRuntimeUpdate.mockResolvedValue(downloaded);
    mocks.applyRuntimeUpdate.mockResolvedValue(applied);
    const manager = new RuntimeUpdateManager();
    await manager.start();

    await manager.updateNow();

    expect(mocks.downloadRuntimeUpdate).not.toHaveBeenCalled();
    expect(mocks.applyRuntimeUpdate).toHaveBeenCalledTimes(1);
    manager.stop();
  });
});
