import { createClient } from "@supabase/supabase-js";

// A tiny key/value surface so the rest of the code never cares whether it is
// talking to Supabase or the in-memory dev fallback. Backed by a single
// `kv(key text primary key, value text, expires_at timestamptz)` table.
export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  setex(key: string, ttlSeconds: number, value: string): Promise<void>;
}

const TABLE = "kv";
let client: KV | null = null;

function makeMemoryKV(): KV {
  // Process-local map. Fine for `vite dev` (single process); never used when
  // Supabase env is set, i.e. never in production.
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

function makeSupabaseKV(url: string, serviceKey: string): KV {
  // Service-role key: server-side only, bypasses RLS. Never ship to the client.
  const sb = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    async get(key) {
      const { data, error } = await sb
        .from(TABLE)
        .select("value, expires_at")
        .eq("key", key)
        .maybeSingle();
      if (error || !data) return null;
      if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
        return null;
      }
      return data.value as string;
    },
    async set(key, value) {
      await sb.from(TABLE).upsert({ key, value, expires_at: null });
    },
    async setex(key, ttl, value) {
      const expires_at = new Date(Date.now() + ttl * 1000).toISOString();
      await sb.from(TABLE).upsert({ key, value, expires_at });
    },
  };
}

export function kv(): KV {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  client = url && serviceKey ? makeSupabaseKV(url, serviceKey) : makeMemoryKV();
  if (!url || !serviceKey) {
    console.warn("[meridian] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — using in-memory store (dev only).");
  }
  return client;
}
