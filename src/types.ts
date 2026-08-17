// Mirrors api/_store.ts + api/feeds.ts

export interface Feed {
  id: string;
  name: string;
  url: string;
  color: string;
  category: string;
  enabled: boolean;
}

export interface Recurrence {
  freq: "weekly";
  days: number[]; // 0=Sun..6=Sat
  until: string | null; // ISO date
}

export interface PersonalEvent {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  category: string;
  notes?: string;
  recurrence?: Recurrence | null;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface CalendarSpace {
  feeds: Feed[];
  events: PersonalEvent[];
  categories: Category[];
  updatedAt: number;
}

export interface FeedEvent {
  id: string;
  source: string;
  sourceName: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  category: string;
  color: string;
  location?: string;
}

export interface FeedsResponse {
  events: FeedEvent[];
  errors: { feed: string; message: string }[];
  fetchedAt: string;
}

/** Unified shape the calendar views render. */
export interface DisplayEvent {
  key: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  categoryId: string;
  color: string;
  sourceLabel: string;
  editable: boolean;
  personalId?: string; // set when it came from a PersonalEvent (for editing)
  location?: string;
}
