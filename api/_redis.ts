import Redis from "ioredis";

// A tiny key/value surface so the rest of the code never cares whether it is
// talking to real Redis or the in-memory dev fallback.
export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  setex(key: string, ttlSeconds: number, value: string): Promise<void>;
}

let client: KV | null = null;

function makeMemoryKV(): KV {
  // Process-local map. Fine for `vite dev` (single process); never used when
  // REDIS_URL is set, i.e. never in production.
  const store = new Map<string, { value: string; expires: number }>();
  const live = (k: string) => {
    const e = store.get(k);
    if (!e) return null;
    if (e.expires && e.expires < Date.now()) {
      store.delete(k);
      return null;
    }
    return e.value;
  };
  return {
    async get(key) {
      return live(key);
    },
    async set(key, value) {
      store.set(key, { value, expires: 0 });
    },
    async setex(key, ttl, value) {
      store.set(key, { value, expires: Date.now() + ttl * 1000 });
    },
  };
}

function makeRedisKV(url: string): KV {
  const redis = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false });
  return {
    async get(key) {
      return redis.get(key);
    },
    async set(key, value) {
      await redis.set(key, value);
    },
    async setex(key, ttl, value) {
      await redis.setex(key, ttl, value);
    },
  };
}

export function kv(): KV {
  if (client) return client;
  const url = process.env.REDIS_URL;
  client = url ? makeRedisKV(url) : makeMemoryKV();
  if (!url) {
    console.warn("[meridian] REDIS_URL not set — using in-memory store (dev only).");
  }
  return client;
}
