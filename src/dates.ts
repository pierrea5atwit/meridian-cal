import type { Category, DisplayEvent, FeedEvent, PersonalEvent } from "./types";

export const DAY_MS = 86_400_000;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  return addDays(x, -x.getDay()); // week starts Sunday
}
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
export function isToday(d: Date): boolean {
  return sameDay(d, new Date());
}

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
export function fmtDayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
}
export function fmtRangeTitle(a: Date, b: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const sameMonth = a.getMonth() === b.getMonth();
  const left = a.toLocaleDateString(undefined, opts);
  const right = b.toLocaleDateString(undefined, sameMonth ? { day: "numeric" } : opts);
  return `${left} – ${right}, ${b.getFullYear()}`;
}

export function categoryColor(cats: Category[], id: string): string {
  return cats.find((c) => c.id === id)?.color ?? "#8a94a6";
}
export function categoryName(cats: Category[], id: string): string {
  return cats.find((c) => c.id === id)?.name ?? id;
}

/** Combine an ISO date-only string (YYYY-MM-DD) with an ISO datetime's clock. */
function atDate(day: Date, timeSource: Date): Date {
  const x = new Date(day);
  x.setHours(
    timeSource.getHours(),
    timeSource.getMinutes(),
    timeSource.getSeconds(),
    0,
  );
  return x;
}

/** Expand personal events (incl. weekly recurrence) into the [from,to] window. */
export function expandPersonal(
  events: PersonalEvent[],
  cats: Category[],
  from: Date,
  to: Date,
): DisplayEvent[] {
  const out: DisplayEvent[] = [];
  for (const ev of events) {
    const baseStart = new Date(ev.start);
    const baseEnd = new Date(ev.end);
    const durationMs = Math.max(0, baseEnd.getTime() - baseStart.getTime());
    const color = categoryColor(cats, ev.category);

    const emit = (start: Date) => {
      const end = new Date(start.getTime() + durationMs);
      if (end < from || start > to) return;
      out.push({
        key: `p:${ev.id}:${start.getTime()}`,
        title: ev.title,
        start,
        end,
        allDay: ev.allDay,
        categoryId: ev.category,
        color,
        sourceLabel: categoryName(cats, ev.category),
        editable: true,
        personalId: ev.id,
        location: undefined,
      });
    };

    if (!ev.recurrence || ev.recurrence.days.length === 0) {
      emit(baseStart);
      continue;
    }

    const until = ev.recurrence.until ? endOfDay(new Date(ev.recurrence.until)) : to;
    const hardStop = until < to ? until : to;
    let cursor = startOfDay(from < baseStart ? baseStart : from);
    for (; cursor <= hardStop; cursor = addDays(cursor, 1)) {
      if (cursor < startOfDay(baseStart)) continue;
      if (ev.recurrence.days.includes(cursor.getDay())) {
        emit(atDate(cursor, baseStart));
      }
    }
  }
  return out;
}

export function feedToDisplay(events: FeedEvent[]): DisplayEvent[] {
  return events.map((e) => ({
    key: `f:${e.id}`,
    title: e.title,
    start: new Date(e.start),
    end: new Date(e.end),
    allDay: e.allDay,
    categoryId: e.category,
    color: e.color,
    sourceLabel: e.sourceName,
    editable: false,
    location: e.location,
  }));
}
