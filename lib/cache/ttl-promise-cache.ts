type CacheEntry<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

type TtlPromiseCacheOptions = {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
};

export function createTtlPromiseCache<T>({
  ttlMs,
  maxEntries,
  now = Date.now,
}: TtlPromiseCacheOptions) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error("ttlMs must be positive.");
  if (!Number.isInteger(maxEntries) || maxEntries <= 0) throw new Error("maxEntries must be a positive integer.");

  const entries = new Map<string, CacheEntry<T>>();

  return {
    get(key: string, loader: () => Promise<T>) {
      const currentTime = now();
      const existing = entries.get(key);
      if (existing && existing.expiresAt > currentTime) return existing.promise;
      if (existing) entries.delete(key);

      const entry: CacheEntry<T> = {
        expiresAt: currentTime + ttlMs,
        promise: Promise.resolve().then(loader),
      };
      entries.set(key, entry);

      while (entries.size > maxEntries) {
        const oldestKey = entries.keys().next().value;
        if (oldestKey === undefined) break;
        entries.delete(oldestKey);
      }

      void entry.promise.catch(() => {
        if (entries.get(key) === entry) entries.delete(key);
      });

      return entry.promise;
    },
    clear() {
      entries.clear();
    },
  };
}
