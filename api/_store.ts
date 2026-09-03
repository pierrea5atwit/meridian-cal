import { kv } from "./_kv.js";

// ---- Shared domain shapes (mirrored in src/types.ts for the frontend) ----

export type Provider = "microsoft" | "google";

export interface Feed {
  id: string;
  name: string;
  url: string; // secret .ics subscription URL
  color: string; // hex
  category: string; // category id, for analytics grouping
  enabled: boolean;
}

export interface Recurrence {
  freq: "weekly";
  days: number[]; // 0=Sun .. 6=Sat
  until: string | null; // ISO date; null = no end
}

export interface PersonalEvent {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  category: string; // category id
  notes?: string;
  recurrence?: Recurrence | null;
}

export interface Category {
  id: string;
  name: string;
  color: string; // hex
}

// OAuth-connected calendar (Outlook/Google). Metadata only — tokens live
// under a separate key that is never returned to the client.
export interface Connection {
  id: string;
  provider: Provider;
  email: string;
  color: string;
  category: string;
  enabled: boolean;
  connectedAt: number;
}

export interface CalendarSpace {
  feeds: Feed[];
  events: PersonalEvent[];
  categories: Category[];
  connections: Connection[];
  updatedAt: number;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: "class", name: "Class", color: "#5b8def" },
  { id: "study", name: "Study", color: "#3fb27f" },
  { id: "workout", name: "Workout", color: "#e8833a" },
  { id: "work", name: "Work", color: "#9b6cf0" },
  { id: "personal", name: "Personal", color: "#e05a6d" },
];

export function emptySpace(): CalendarSpace {
  return { feeds: [], events: [], categories: DEFAULT_CATEGORIES, connections: [], updatedAt: 0 };
}

const key = (id: string) => `meridian:space:${id}`;

export async function loadSpace(id: string): Promise<CalendarSpace> {
  const raw = await kv().get(key(id));
  if (!raw) return emptySpace();
  try {
    const parsed = JSON.parse(raw) as Partial<CalendarSpace>;
    return {
      feeds: parsed.feeds ?? [],
      events: parsed.events ?? [],
      categories: parsed.categories?.length ? parsed.categories : DEFAULT_CATEGORIES,
      connections: parsed.connections ?? [],
      updatedAt: parsed.updatedAt ?? 0,
    };
  } catch {
    return emptySpace();
  }
}

export async function saveSpace(id: string, space: CalendarSpace): Promise<CalendarSpace> {
  const next: CalendarSpace = { ...space, updatedAt: Date.now() };
  await kv().set(key(id), JSON.stringify(next));
  return next;
}

// ---- OAuth token storage (server-only; never leaves the API) ----

export interface OAuthToken {
  provider: Provider;
  refreshToken: string;
  scope?: string;
}

const tokenKey = (spaceId: string, connId: string) => `meridian:token:${spaceId}:${connId}`;
const atokKey = (spaceId: string, connId: string) => `meridian:atok:${spaceId}:${connId}`;

export async function saveToken(spaceId: string, connId: string, t: OAuthToken): Promise<void> {
  await kv().set(tokenKey(spaceId, connId), JSON.stringify(t));
}

export async function loadToken(spaceId: string, connId: string): Promise<OAuthToken | null> {
  const raw = await kv().get(tokenKey(spaceId, connId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OAuthToken;
  } catch {
    return null;
  }
}

export async function deleteToken(spaceId: string, connId: string): Promise<void> {
  // kv has no delete; empty string reads back as absent.
  await kv().set(tokenKey(spaceId, connId), "");
  await kv().set(atokKey(spaceId, connId), "");
}

/** Short-lived access-token cache so /api/feeds doesn't refresh on every call. */
export async function getCachedAccessToken(spaceId: string, connId: string): Promise<string | null> {
  return kv().get(atokKey(spaceId, connId));
}
export async function cacheAccessToken(
  spaceId: string,
  connId: string,
  token: string,
  ttlSeconds: number,
): Promise<void> {
  await kv().setex(atokKey(spaceId, connId), Math.max(60, ttlSeconds), token);
}
