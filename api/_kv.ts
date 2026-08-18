import postgres from "postgres";

// A tiny key/value surface so the rest of the code never cares whether it is
// talking to Postgres (Supabase) or the in-memory dev fallback. The table is
// created on first use, so there is no manual migration step.
export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  setex(key: string, ttlSeconds: number, value: string): Promise<void>;
}

let client: KV | null = null;

function makeMemoryKV(): KV {
  // Process-local map. Fine for `vite dev` (single process); never used when
  // POSTGRES_URL is set, i.e. never in production.
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

function makePostgresKV(url: string): KV {
  // prepare:false is required for Supabase's transaction pooler; max:1 keeps a
  // serverless invocation from opening a fan-out of connections.
  const sql = postgres(url, { prepare: false, max: 1, idle_timeout: 20 });

  let ready: Promise<void> | null = null;
  const ensureTable = () =>
    (ready ??= (async () => {
      await sql`create table if not exists kv (
        key text primary key,
        value text not null,
        expires_at timestamptz
      )`;
      // Block anon PostgREST access; our direct (owner) connection bypasses RLS.
      await sql`alter table kv enable row level security`;
    })());

  return {
    async get(key) {
      await ensureTable();
      const rows = await sql<{ value: string; expires_at: Date | null }[]>`
        select value, expires_at from kv where key = ${key}`;
      const row = rows[0];
      if (!row) return null;
      if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
        return null;
      }
      return row.value;
    },
    async set(key, value) {
      await ensureTable();
      await sql`
        insert into kv (key, value, expires_at) values (${key}, ${value}, null)
        on conflict (key) do update set value = excluded.value, expires_at = null`;
    },
    async setex(key, ttl, value) {
      await ensureTable();
      const expires = new Date(Date.now() + ttl * 1000).toISOString();
      await sql`
        insert into kv (key, value, expires_at) values (${key}, ${value}, ${expires})
        on conflict (key) do update set value = excluded.value, expires_at = excluded.expires_at`;
    },
  };
}

export function kv(): KV {
  if (client) return client;
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  client = url ? makePostgresKV(url) : makeMemoryKV();
  if (!url) {
    console.warn("[meridian] POSTGRES_URL not set — using in-memory store (dev only).");
  }
  return client;
}
