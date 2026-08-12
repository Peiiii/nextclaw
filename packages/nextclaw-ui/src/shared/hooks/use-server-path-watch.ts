import { useEffect } from 'react';
import { unwatchServerPaths, watchServerPaths } from '@/shared/lib/api';

const SERVER_PATH_WATCH_HEARTBEAT_MS = 2 * 60_000;

export function useServerPathWatch(directories: readonly string[]): void {
  const signature = directories.join('\n');

  useEffect(() => {
    const watchedDirectories = signature.split('\n').filter(Boolean);
    if (watchedDirectories.length === 0) return;
    let disposed = false;
    let subscriptionId: string | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    const subscribe = async () => {
      try {
        const result = await watchServerPaths({
          directories: watchedDirectories,
          subscriptionId,
        });
        if (disposed) {
          await unwatchServerPaths(result.subscriptionId).catch(() => undefined);
          return;
        }
        subscriptionId = result.subscriptionId;
      } catch (error) {
        console.warn('Project file auto-refresh is unavailable; manual refresh remains available.', error);
      }
    };

    void subscribe().then(() => {
      if (!disposed && subscriptionId) heartbeat = setInterval(() => void subscribe(), SERVER_PATH_WATCH_HEARTBEAT_MS);
    });

    return () => {
      disposed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (subscriptionId) void unwatchServerPaths(subscriptionId).catch(() => undefined);
    };
  }, [signature]);
}
