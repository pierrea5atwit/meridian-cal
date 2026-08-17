import { useEffect, useMemo, useState } from "react";
import { useMeridian } from "./useMeridian";
import {
  addDays,
  endOfMonth,
  expandPersonal,
  feedToDisplay,
  fmtRangeTitle,
  startOfMonth,
  startOfWeek,
} from "./dates";
import type { DisplayEvent, PersonalEvent } from "./types";
import WeekView from "./components/WeekView";
import MonthView from "./components/MonthView";
import Analytics from "./components/Analytics";
import Settings from "./components/Settings";
import EventModal from "./components/EventModal";
import SpaceGate from "./components/SpaceGate";

type View = "week" | "month" | "analytics" | "settings";
const LS_KEY = "meridian:lastSpace";

function readHashId(): string {
  return decodeURIComponent(location.hash.replace(/^#/, "")).trim();
}

export default function App() {
  const [spaceId, setSpaceId] = useState<string>(readHashId);
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [editing, setEditing] = useState<PersonalEvent | "new" | null>(null);

  useEffect(() => {
    const onHash = () => setSpaceId(readHashId());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (spaceId) localStorage.setItem(LS_KEY, spaceId);
  }, [spaceId]);

  const m = useMeridian(spaceId || "__none__", anchor);

  // Visible window for the active view.
  const [winFrom, winTo] = useMemo<[Date, Date]>(() => {
    if (view === "month") {
      const s = startOfWeek(startOfMonth(anchor));
      return [s, addDays(s, 42)];
    }
    if (view === "week") {
      const s = startOfWeek(anchor);
      return [s, addDays(s, 7)];
    }
    // analytics defaults to the visible month
    return [startOfMonth(anchor), endOfMonth(anchor)];
  }, [view, anchor]);

  const events: DisplayEvent[] = useMemo(() => {
    if (!m.space) return [];
    const personal = expandPersonal(m.space.events, m.space.categories, winFrom, winTo);
    const feeds = feedToDisplay(m.feedEvents).filter(
      (e) => e.end >= winFrom && e.start <= winTo,
    );
    return [...personal, ...feeds].sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [m.space, m.feedEvents, winFrom, winTo]);

  if (!spaceId) {
    return (
      <SpaceGate
        initial={localStorage.getItem(LS_KEY) ?? ""}
        onPick={(id) => {
          location.hash = id;
          setSpaceId(id);
        }}
      />
    );
  }

  const monthLike = view === "month" || view === "analytics";

  const step = (dir: number) =>
    setAnchor((a) => (monthLike ? new Date(a.getFullYear(), a.getMonth() + dir, 1) : addDays(a, dir * 7)));

  const title = monthLike
    ? anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : fmtRangeTitle(startOfWeek(anchor), addDays(startOfWeek(anchor), 6));

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="dot" />
          Meridian
          <button className="space-chip" title="Switch calendar space" onClick={() => { location.hash = ""; setSpaceId(""); }}>
            {spaceId}
          </button>
        </div>
        <nav className="tabs">
          {(["week", "month", "analytics", "settings"] as View[]).map((v) => (
            <button
              key={v}
              className={view === v ? "tab active" : "tab"}
              onClick={() => setView(v)}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </nav>
      </header>

      {(view === "week" || view === "month" || view === "analytics") && (
        <div className="subbar">
          <div className="nav">
            <button onClick={() => step(-1)} aria-label="Previous">‹</button>
            <button className="today" onClick={() => setAnchor(new Date())}>Today</button>
            <button onClick={() => step(1)} aria-label="Next">›</button>
          </div>
          <div className="range-title">{title}</div>
          <div className="right-slot">
            {m.refreshing && <span className="sync">syncing…</span>}
            {view !== "analytics" && (
              <button className="add-btn" onClick={() => setEditing("new")}>+ Event</button>
            )}
          </div>
        </div>
      )}

      {m.error && <div className="banner error">{m.error}</div>}
      {m.feedErrors.length > 0 && (
        <div className="banner warn">
          {m.feedErrors.map((e, i) => (
            <span key={i}>⚠ {e.feed}: {e.message}. </span>
          ))}
        </div>
      )}

      <main className="content">
        {m.loading || !m.space ? (
          <div className="loading">Loading…</div>
        ) : view === "week" ? (
          <WeekView
            anchor={anchor}
            events={events}
            onPick={(ev) => ev.personalId && setEditing(findPersonal(m.space!.events, ev.personalId))}
            onCreateAt={(start) => setEditing(newAt(start, m.space!.categories[0]?.id ?? "personal"))}
          />
        ) : view === "month" ? (
          <MonthView
            anchor={anchor}
            events={events}
            onPickDay={(d) => { setAnchor(d); setView("week"); }}
            onPick={(ev) => ev.personalId && setEditing(findPersonal(m.space!.events, ev.personalId))}
          />
        ) : view === "analytics" ? (
          <Analytics events={events} categories={m.space.categories} from={winFrom} to={winTo} />
        ) : (
          <Settings state={m} />
        )}
      </main>

      {editing !== null && m.space && (
        <EventModal
          initial={editing === "new" ? newAt(defaultStart(), m.space.categories[0]?.id ?? "personal") : editing}
          categories={m.space.categories}
          onClose={() => setEditing(null)}
          onSave={async (ev) => { await m.upsertEvent(ev); setEditing(null); }}
          onDelete={
            editing !== "new"
              ? async (id) => { await m.deleteEvent(id); setEditing(null); }
              : undefined
          }
        />
      )}
    </div>
  );
}

function findPersonal(events: PersonalEvent[], id: string): PersonalEvent | "new" {
  return events.find((e) => e.id === id) ?? "new";
}

function defaultStart(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function newAt(start: Date, category: string): PersonalEvent {
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    id: crypto.randomUUID(),
    title: "",
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: false,
    category,
    recurrence: null,
  };
}
