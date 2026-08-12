import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { FSWatcher } from 'node:fs';
import { eventKeys, type EventBus } from '@nextclaw/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerPathWatchService } from './server-path-watch.service.js';

describe('ServerPathWatchService', () => {
  afterEach(() => vi.useRealTimers());

  it('shares shallow watchers, batches events, and releases them with the subscription', async () => {
    vi.useFakeTimers();
    const root = await mkdtemp(join(tmpdir(), 'nextclaw-path-watch-'));
    const child = join(root, 'src');
    await mkdir(child);
    const listeners = new Map<string, () => void>();
    const closed = new Set<string>();
    const emit = vi.fn();
    const service = new ServerPathWatchService(
      { emit } as unknown as Pick<EventBus, 'emit'>,
      {
        debounceMs: 20,
        leaseMs: 1_000,
        watchFactory: (path, listener) => {
          listeners.set(path, listener);
          const watcher = new EventEmitter() as EventEmitter & FSWatcher;
          watcher.close = () => {
            closed.add(path);
          };
          return watcher;
        },
      },
    );

    const result = await service.subscribe({ directories: [root, child] });
    const resolvedRoot = resolve(root);
    const resolvedChild = resolve(child);
    listeners.get(resolvedChild)?.();
    listeners.get(resolvedChild)?.();
    await vi.advanceTimersByTimeAsync(20);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      eventKeys.serverPathChanged,
      { directoryPath: resolvedChild },
      expect.objectContaining({ source: 'backend' }),
    );

    await service.subscribe({ subscriptionId: result.subscriptionId, directories: [root] });
    expect(closed.has(resolvedChild)).toBe(true);
    service.unsubscribe(result.subscriptionId);
    expect(closed.has(resolvedRoot)).toBe(true);
  });
});
