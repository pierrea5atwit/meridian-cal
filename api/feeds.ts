import ical from "node-ical";
import { createHash } from "node:crypto";
import { sendJson, query, safeId, type Req, type Res } from "./_http.js";
import { kv } from "./_kv.js";
import { loadSpace, type Feed } from "./_store.js";

const RAW_TTL_SECONDS = 15 * 60; // re-fetch each feed at most every 15 min

export interface MergedEvent {
  id: string;
  source: string; // feed id
  sourceName: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  category: string;
  color: string;
  location?: string;
}

const rawKey = (url: string) => `meridian:ics:${createHash("sha1").update(url).digest("hex")}`;

function normalizeUrl(url: string): string {
  return url.replace(/^webcal:\/\//i, "https://");
}

async function fetchRawIcs(url: string): Promise<string | null> {
  const cacheKey = rawKey(url);
  const cached = await kv().get(cacheKey);
  if (cached !== null) return cached;
  try {
    const resp = await fetch(normalizeUrl(url), {
      headers: { "User-Agent": "Meridian/0.1 (+calendar aggregator)" },
      redirect: "follow",
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    await kv().setex(cacheKey, RAW_TTL_SECONDS, text);
    return text;
  } catch {
    return null;
  }
}

/** Expand one VEVENT (single or recurring) into occurrences within [from,to]. */
function expandEvent(
  ev: any,
  feed: Feed,
  from: Date,
  to: Date,
  out: MergedEvent[],
): void {
  if (ev.type !== "VEVENT" || !ev.start) return;

  const allDay = ev.datetype === "date";
  const startMs = new Date(ev.start).getTime();
  const endMs = ev.end ? new Date(ev.end).getTime() : startMs + 60 * 60 * 1000;
  const durationMs = Math.max(0, endMs - startMs);

  const push = (occStart: Date) => {
    const s = occStart.getTime();
    const e = s + durationMs;
    if (e < from.getTime() || s > to.getTime()) return;
    out.push({
      id: `${feed.id}:${ev.uid ?? "?"}:${s}`,
      source: feed.id,
      sourceName: feed.name,
      title: ev.summary || "(untitled)",
      start: new Date(s).toISOString(),
      end: new Date(e).toISOString(),
      allDay,
      category: feed.category,
      color: feed.color,
      location: ev.location || undefined,
    });
  };

  if (!ev.rrule) {
    push(new Date(startMs));
    return;
  }

  // Recurring: collect occurrences in-window, minus EXDATEs, applying overrides.
  const exdates = new Set<number>(
    Object.values(ev.exdate ?? {}).map((d: any) => new Date(d).setHours(0, 0, 0, 0)),
  );
  const overrides = ev.recurrences ?? {};
  const dates: Date[] = ev.rrule.between(from, to, true);
  for (const d of dates) {
    if (exdates.has(new Date(d).setHours(0, 0, 0, 0))) continue;
    const dayKey = new Date(d).toISOString().slice(0, 10);
    const override = overrides[dayKey];
    if (override && override.start) {
      const os = new Date(override.start).getTime();
      const oe = override.end ? new Date(override.end).getTime() : os + durationMs;
      out.push({
        id: `${feed.id}:${ev.uid ?? "?"}:${os}`,
        source: feed.id,
        sourceName: feed.name,
        title: override.summary || ev.summary || "(untitled)",
        start: new Date(os).toISOString(),
        end: new Date(oe).toISOString(),
        allDay,
        category: feed.category,
        color: feed.color,
        location: override.location || ev.location || undefined,
      });
    } else {
      push(new Date(d));
    }
  }
}

// GET /api/feeds?id=<slug>&start=<ISO>&end=<ISO>
// Fetches + parses each enabled feed and returns merged, expanded occurrences.
export default async function handler(req: Req, res: Res): Promise<void> {
  const q = query(req);
  const id = safeId(q.get("id"));
  if (!id) {
    sendJson(res, 400, { error: "missing or invalid ?id" });
    return;
  }

  const now = Date.now();
  const from = new Date(q.get("start") ?? now - 7 * 864e5);
  const to = new Date(q.get("end") ?? now + 35 * 864e5);

  const space = await loadSpace(id);
  const feeds = space.feeds.filter((f) => f.enabled && f.url);

  const events: MergedEvent[] = [];
  const errors: { feed: string; message: string }[] = [];

  await Promise.all(
    feeds.map(async (feed) => {
      const raw = await fetchRawIcs(feed.url);
      if (raw === null) {
        errors.push({ feed: feed.name, message: "could not fetch feed" });
        return;
      }
      try {
        const parsed = await ical.async.parseICS(raw);
        for (const ev of Object.values(parsed)) {
          expandEvent(ev, feed, from, to, events);
        }
      } catch (err) {
        errors.push({ feed: feed.name, message: String(err) });
      }
    }),
  );

  events.sort((a, b) => a.start.localeCompare(b.start));
  sendJson(res, 200, { events, errors, fetchedAt: new Date().toISOString() });
}
