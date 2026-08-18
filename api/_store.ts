import { kv } from "./_kv.js";

// ---- Shared domain shapes (mirrored in src/types.ts for the frontend) ----

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

export interface CalendarSpace {
  feeds: Feed[];
  events: PersonalEvent[];
  categories: Category[];
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
  return { feeds: [], events: [], categories: DEFAULT_CATEGORIES, updatedAt: 0 };
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
