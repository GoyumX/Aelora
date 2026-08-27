import { describe, expect, it, vi } from "vitest";

import { createTtlPromiseCache } from "@/lib/cache/ttl-promise-cache";

describe("createTtlPromiseCache", () => {
  it("deduplicates concurrent loads and reuses a fresh value", async () => {
    let now = 1_000;
    const cache = createTtlPromiseCache<string>({ ttlMs: 60_000, maxEntries: 4, now: () => now });
    const loader = vi.fn(async () => "history");

    const [first, second] = await Promise.all([
      cache.get("site:range", loader),
      cache.get("site:range", loader),
    ]);
    now += 30_000;
    const third = await cache.get("site:range", loader);

    expect([first, second, third]).toEqual(["history", "history", "history"]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("reloads expired entries and evicts a rejected promise", async () => {
    let now = 1_000;
    const cache = createTtlPromiseCache<number>({ ttlMs: 100, maxEntries: 4, now: () => now });
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);

    await expect(cache.get("key", loader)).rejects.toThrow("temporary failure");
    await expect(cache.get("key", loader)).resolves.toBe(2);
    now += 101;
    await expect(cache.get("key", loader)).resolves.toBe(3);
    expect(loader).toHaveBeenCalledTimes(3);
  });

  it("keeps the cache bounded by evicting the oldest entry", async () => {
    let now = 1_000;
    const cache = createTtlPromiseCache<string>({ ttlMs: 60_000, maxEntries: 2, now: () => now });
    const loader = vi.fn(async (value: string) => value);

    await cache.get("a", () => loader("a"));
    now += 1;
    await cache.get("b", () => loader("b"));
    now += 1;
    await cache.get("c", () => loader("c"));
    await cache.get("a", () => loader("a-again"));

    expect(loader).toHaveBeenCalledTimes(4);
    expect(loader).toHaveBeenLastCalledWith("a-again");
  });
});
