/**
 * dal/cache.ts
 *
 * Lightweight two-tier cache (memory + sessionStorage) for Firestore reads.
 *
 * Tier 1 — in-memory Map: zero latency, cleared on page unload.
 * Tier 2 — sessionStorage: survives React re-renders / soft navigations
 *           within the same browser tab; cleared when the tab closes.
 *
 * Usage:
 *   cache.set('users/abc123', data, 60_000);   // 60-second TTL
 *   const hit = cache.get<UserDoc>('users/abc123');
 *   cache.invalidate('users/abc123');
 *   cache.invalidatePrefix('organizations/');
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number; // Date.now() + ttl
}

class DalCache {
  private mem = new Map<string, CacheEntry<unknown>>();

  /** Default TTLs in milliseconds */
  static TTL = {
    USER_DOC:   60_000,   //  1 min  — credits/consent can change
    ORG_DOC:    120_000,  //  2 min  — org data changes less often
    PROJECT_DOC: 120_000, //  2 min
    INDIVIDUAL_DOC: 120_000,
    SHOWCASE_DOC: 120_000, //  2 min
    CODE_LOOKUP: 300_000, //  5 min  — short-code → doc ID mapping rarely changes
    CONFIG:     600_000,  // 10 min  — pricing config
  };

  // ── Read ─────────────────────────────────────────────────────────────────

  get<T>(key: string): T | null {
    // Memory first
    const memEntry = this.mem.get(key) as CacheEntry<T> | undefined;
    if (memEntry) {
      if (Date.now() < memEntry.expiresAt) return memEntry.data;
      this.mem.delete(key);
    }

    // sessionStorage fallback (client only)
    if (typeof sessionStorage === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(`dal:${key}`);
      if (!raw) return null;
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (Date.now() < entry.expiresAt) {
        // Promote back to memory
        this.mem.set(key, entry);
        return entry.data;
      }
      sessionStorage.removeItem(`dal:${key}`);
    } catch { /* ignore parse errors */ }
    return null;
  }

  // ── Write ────────────────────────────────────────────────────────────────

  set<T>(key: string, data: T, ttl: number): void {
    const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttl };
    this.mem.set(key, entry);
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(`dal:${key}`, JSON.stringify(entry));
    } catch { /* quota exceeded — ignore */ }
  }

  // ── Invalidation ─────────────────────────────────────────────────────────

  invalidate(key: string): void {
    this.mem.delete(key);
    if (typeof sessionStorage !== 'undefined') {
      try { sessionStorage.removeItem(`dal:${key}`); } catch { /* ignore */ }
    }
  }

  /** Removes all cache entries whose key starts with the given prefix. */
  invalidatePrefix(prefix: string): void {
    for (const key of this.mem.keys()) {
      if (key.startsWith(prefix)) this.mem.delete(key);
    }
    if (typeof sessionStorage === 'undefined') return;
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k?.startsWith(`dal:${prefix}`)) toRemove.push(k);
      }
      toRemove.forEach(k => sessionStorage.removeItem(k));
    } catch { /* ignore */ }
  }

  /** Wipes the entire cache (e.g. on sign-out). */
  clear(): void {
    this.mem.clear();
    if (typeof sessionStorage === 'undefined') return;
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k?.startsWith('dal:')) toRemove.push(k!);
      }
      toRemove.forEach(k => sessionStorage.removeItem(k));
    } catch { /* ignore */ }
  }
}

/** Singleton cache instance shared across all DAL modules. */
export const cache = new DalCache();
export { DalCache };
