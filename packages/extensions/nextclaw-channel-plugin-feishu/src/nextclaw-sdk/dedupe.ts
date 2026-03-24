import fs from "node:fs";
import path from "node:path";

function pruneMapToMaxSize<K, V>(map: Map<K, V>, maxSize: number): void {
  while (map.size > maxSize) {
    const firstKey = map.keys().next().value;
    if (firstKey === undefined) {
      break;
    }
    map.delete(firstKey);
  }
}

export function createDedupeCache(options: {
  ttlMs: number;
  maxSize: number;
}): {
  check: (key: string | undefined | null, now?: number) => boolean;
  peek: (key: string | undefined | null, now?: number) => boolean;
  delete: (key: string | undefined | null) => void;
  clear: () => void;
  size: () => number;
} {
  const ttlMs = Math.max(0, options.ttlMs);
  const maxSize = Math.max(0, Math.floor(options.maxSize));
  const cache = new Map<string, number>();

  const touch = (key: string, now: number) => {
    cache.delete(key);
    cache.set(key, now);
  };

  const prune = (now: number) => {
    const cutoff = ttlMs > 0 ? now - ttlMs : undefined;
    if (cutoff !== undefined) {
      for (const [key, seenAt] of cache) {
        if (seenAt < cutoff) {
          cache.delete(key);
        }
      }
    }
    if (maxSize <= 0) {
      cache.clear();
      return;
    }
    pruneMapToMaxSize(cache, maxSize);
  };

  const hasUnexpired = (key: string, now: number, touchOnRead: boolean): boolean => {
    const seenAt = cache.get(key);
    if (seenAt === undefined) {
      return false;
    }
    if (ttlMs > 0 && now - seenAt >= ttlMs) {
      cache.delete(key);
      return false;
    }
    if (touchOnRead) {
      touch(key, now);
    }
    return true;
  };

  return {
    check: (key, now = Date.now()) => {
      if (!key) {
        return false;
      }
      if (hasUnexpired(key, now, true)) {
        return true;
      }
      touch(key, now);
      prune(now);
      return false;
    },
    peek: (key, now = Date.now()) => {
      if (!key) {
        return false;
      }
      return hasUnexpired(key, now, false);
    },
    delete: (key) => {
      if (key) {
        cache.delete(key);
      }
    },
    clear: () => cache.clear(),
    size: () => cache.size,
  };
}

export async function readJsonFileWithFallback<T>(
  filePath: string,
  fallback: T,
): Promise<{ value: T; exists: boolean }> {
  try {
    const raw = await fs.promises.readFile(filePath, "utf-8");
    return { value: JSON.parse(raw) as T, exists: true };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOENT") {
      return { value: fallback, exists: false };
    }
    return { value: fallback, exists: false };
  }
}

async function writeJsonFileAtomically(filePath: string, value: unknown): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.promises.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await fs.promises.rename(tempPath, filePath);
}

export function createPersistentDedupe(options: {
  ttlMs: number;
  memoryMaxSize: number;
  fileMaxEntries: number;
  resolveFilePath: (namespace: string) => string;
  onDiskError?: (error: unknown) => void;
}) {
  const ttlMs = Math.max(0, Math.floor(options.ttlMs));
  const fileMaxEntries = Math.max(1, Math.floor(options.fileMaxEntries));
  const memory = createDedupeCache({
    ttlMs,
    maxSize: Math.max(0, Math.floor(options.memoryMaxSize)),
  });
  const inflight = new Map<string, Promise<boolean>>();

  const sanitize = (value: unknown): Record<string, number> => {
    if (!value || typeof value !== "object") {
      return {};
    }
    const out: Record<string, number> = {};
    for (const [key, timestamp] of Object.entries(value as Record<string, unknown>)) {
      if (typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp > 0) {
        out[key] = timestamp;
      }
    }
    return out;
  };

  const pruneData = (data: Record<string, number>, now: number) => {
    if (ttlMs > 0) {
      for (const [key, timestamp] of Object.entries(data)) {
        if (now - timestamp >= ttlMs) {
          delete data[key];
        }
      }
    }
    const keys = Object.keys(data);
    if (keys.length > fileMaxEntries) {
      keys
        .toSorted((left, right) => data[left] - data[right])
        .slice(0, keys.length - fileMaxEntries)
        .forEach((key) => {
          delete data[key];
        });
    }
  };

  const checkAndRecordInner = async (
    key: string,
    namespace: string,
    scopedKey: string,
    now: number,
    onDiskError?: (error: unknown) => void,
  ): Promise<boolean> => {
    if (memory.check(scopedKey, now)) {
      return false;
    }

    const filePath = options.resolveFilePath(namespace);
    try {
      const { value } = await readJsonFileWithFallback<Record<string, number>>(filePath, {});
      const data = sanitize(value);
      const seenAt = data[key];
      if (seenAt != null && (ttlMs <= 0 || now - seenAt < ttlMs)) {
        return false;
      }
      data[key] = now;
      pruneData(data, now);
      await writeJsonFileAtomically(filePath, data);
      return true;
    } catch (error) {
      onDiskError?.(error);
      memory.check(scopedKey, now);
      return true;
    }
  };

  return {
    async checkAndRecord(
      key: string,
      dedupeOptions?: {
        namespace?: string;
        now?: number;
        onDiskError?: (error: unknown) => void;
      },
    ): Promise<boolean> {
      const trimmed = key.trim();
      if (!trimmed) {
        return true;
      }
      const namespace = dedupeOptions?.namespace?.trim() || "global";
      const scopedKey = `${namespace}:${trimmed}`;
      if (inflight.has(scopedKey)) {
        return false;
      }
      const work = checkAndRecordInner(
        trimmed,
        namespace,
        scopedKey,
        dedupeOptions?.now ?? Date.now(),
        dedupeOptions?.onDiskError ?? options.onDiskError,
      );
      inflight.set(scopedKey, work);
      try {
        return await work;
      } finally {
        inflight.delete(scopedKey);
      }
    },
    async warmup(namespace = "global", onError?: (error: unknown) => void): Promise<number> {
      const filePath = options.resolveFilePath(namespace);
      try {
        const { value } = await readJsonFileWithFallback<Record<string, number>>(filePath, {});
        const now = Date.now();
        let loaded = 0;
        for (const [key, timestamp] of Object.entries(sanitize(value))) {
          if (ttlMs > 0 && now - timestamp >= ttlMs) {
            continue;
          }
          memory.check(`${namespace}:${key}`, timestamp);
          loaded += 1;
        }
        return loaded;
      } catch (error) {
        onError?.(error);
        return 0;
      }
    },
    clearMemory: () => memory.clear(),
    memorySize: () => memory.size(),
  };
}
