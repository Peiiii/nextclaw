import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { watch, type FSWatcher } from 'node:fs';
import { resolve } from 'node:path';
import { eventKeys, type EventBus } from '@nextclaw/shared';

const DEFAULT_LEASE_MS = 5 * 60_000;
const DEFAULT_EVENT_DEBOUNCE_MS = 80;
const MAX_DIRECTORIES_PER_SUBSCRIPTION = 64;
const MAX_WATCHED_DIRECTORIES = 256;

type DirectoryWatcher = {
  refs: Set<string>;
  watcher: FSWatcher;
  emitTimer: NodeJS.Timeout | null;
};

type WatchSubscription = {
  directories: Set<string>;
  leaseTimer: NodeJS.Timeout;
};

type WatchFactory = (path: string, listener: () => void) => FSWatcher;

export class ServerPathWatchService {
  private readonly watchers = new Map<string, DirectoryWatcher>();
  private readonly subscriptions = new Map<string, WatchSubscription>();

  constructor(
    private readonly eventBus: Pick<EventBus, 'emit'>,
    private readonly options: {
      debounceMs?: number;
      leaseMs?: number;
      watchFactory?: WatchFactory;
    } = {},
  ) {}

  readonly subscribe = async (params: {
    subscriptionId?: string | null;
    directories: readonly string[];
  }): Promise<{ subscriptionId: string; watchedDirectories: string[] }> => {
    const subscriptionId = params.subscriptionId?.trim() || randomUUID();
    const existing = this.subscriptions.get(subscriptionId);
    const directories = new Set(
      (
        await Promise.all(
          params.directories.slice(0, MAX_DIRECTORIES_PER_SUBSCRIPTION).map(async (path) => this.resolveDirectory(path)),
        )
      ).filter((path): path is string => path !== null),
    );

    const previousDirectories = existing?.directories ?? new Set<string>();
    const releasableDirectoryCount = [...previousDirectories].filter((path) => {
      const directoryWatcher = this.watchers.get(path);
      return !directories.has(path) && directoryWatcher?.refs.size === 1 && directoryWatcher.refs.has(subscriptionId);
    }).length;
    const newDirectoryCount = [...directories].filter((path) => !this.watchers.has(path)).length;
    if (this.watchers.size - releasableDirectoryCount + newDirectoryCount > MAX_WATCHED_DIRECTORIES) {
      throw new Error('server path watch capacity exceeded');
    }

    for (const path of previousDirectories) {
      if (!directories.has(path)) this.releaseDirectory(path, subscriptionId);
    }
    for (const path of directories) {
      if (!previousDirectories.has(path) || !this.watchers.has(path)) {
        try {
          this.retainDirectory(path, subscriptionId);
        } catch {
          directories.delete(path);
        }
      }
    }
    if (existing) clearTimeout(existing.leaseTimer);
    const leaseTimer = setTimeout(() => this.unsubscribe(subscriptionId), this.options.leaseMs ?? DEFAULT_LEASE_MS);
    leaseTimer.unref?.();
    this.subscriptions.set(subscriptionId, { directories, leaseTimer });
    return { subscriptionId, watchedDirectories: [...directories] };
  };

  readonly unsubscribe = (subscriptionId: string): void => {
    const normalizedId = subscriptionId.trim();
    const subscription = this.subscriptions.get(normalizedId);
    if (!subscription) return;
    clearTimeout(subscription.leaseTimer);
    for (const path of subscription.directories) this.releaseDirectory(path, normalizedId);
    this.subscriptions.delete(normalizedId);
  };

  readonly close = (): void => {
    for (const subscriptionId of [...this.subscriptions.keys()]) this.unsubscribe(subscriptionId);
  };

  private readonly resolveDirectory = async (path: string): Promise<string | null> => {
    const normalized = path.trim();
    if (!normalized) return null;
    try {
      const resolved = resolve(normalized);
      return (await stat(resolved)).isDirectory() ? resolved : null;
    } catch {
      return null;
    }
  };

  private readonly retainDirectory = (path: string, subscriptionId: string): void => {
    const existing = this.watchers.get(path);
    if (existing) {
      existing.refs.add(subscriptionId);
      return;
    }
    const watchFactory = this.options.watchFactory ?? ((target, listener) => watch(target, { persistent: false }, listener));
    const directoryWatcher: DirectoryWatcher = {
      refs: new Set([subscriptionId]),
      watcher: watchFactory(path, () => this.scheduleDirectoryChanged(path)),
      emitTimer: null,
    };
    directoryWatcher.watcher.on('error', () => this.closeDirectory(path));
    this.watchers.set(path, directoryWatcher);
  };

  private readonly releaseDirectory = (path: string, subscriptionId: string): void => {
    const directoryWatcher = this.watchers.get(path);
    if (!directoryWatcher) return;
    directoryWatcher.refs.delete(subscriptionId);
    if (directoryWatcher.refs.size === 0) this.closeDirectory(path);
  };

  private readonly closeDirectory = (path: string): void => {
    const directoryWatcher = this.watchers.get(path);
    if (!directoryWatcher) return;
    if (directoryWatcher.emitTimer) clearTimeout(directoryWatcher.emitTimer);
    directoryWatcher.watcher.close();
    this.watchers.delete(path);
  };

  private readonly scheduleDirectoryChanged = (directoryPath: string): void => {
    const directoryWatcher = this.watchers.get(directoryPath);
    if (!directoryWatcher || directoryWatcher.emitTimer) return;
    directoryWatcher.emitTimer = setTimeout(() => {
      directoryWatcher.emitTimer = null;
      this.eventBus.emit(
        eventKeys.serverPathChanged,
        { directoryPath },
        { emittedAt: new Date().toISOString(), source: 'backend' },
      );
    }, this.options.debounceMs ?? DEFAULT_EVENT_DEBOUNCE_MS);
    directoryWatcher.emitTimer.unref?.();
  };
}
