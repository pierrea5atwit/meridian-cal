import type { CalendarSpace, FeedsResponse } from "./types";

export async function getSpace(id: string): Promise<CalendarSpace> {
  const r = await fetch(`/api/space?id=${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error(`getSpace failed: ${r.status}`);
  return r.json();
}

export async function putSpace(id: string, space: CalendarSpace): Promise<CalendarSpace> {
  const r = await fetch(`/api/space?id=${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(space),
  });
  if (!r.ok) throw new Error(`putSpace failed: ${r.status}`);
  return r.json();
}

export async function getFeeds(id: string, start: Date, end: Date): Promise<FeedsResponse> {
  const params = new URLSearchParams({
    id,
    start: start.toISOString(),
    end: end.toISOString(),
  });
  const r = await fetch(`/api/feeds?${params}`);
  if (!r.ok) throw new Error(`getFeeds failed: ${r.status}`);
  return r.json();
}
