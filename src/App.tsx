import { useEffect, useMemo, useState } from "react";
import { useMeridian } from "./useMeridian";
import {
  addDays,
  endOfMonth,
  expandPersonal,
  feedToDisplay,
  fmtRangeTitle,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "./dates";
import type { DisplayEvent, PersonalEvent } from "./types";
import AgendaView from "./components/AgendaView";
import WeekView from "./components/WeekView";
import MonthView from "./components/MonthView";
import Analytics from "./components/Analytics";
import Settings from "./components/Settings";
import EventModal from "./components/EventModal";
import SpaceGate from "./components/SpaceGate";

type View = "agenda" | "week" | "month" | "analytics" | "settings";
const LS_KEY = "meridian:lastSpace";

function parseHash(): { id: string; params: URLSearchParams } {
  const raw = location.hash.replace(/^#/, "");
  const qi = raw.indexOf("?");
  const idPart = qi >= 0 ? raw.slice(0, qi) : raw;
  const params = new URLSearchParams(qi >= 0 ? raw.slice(qi + 1) : "");
  return { id: decodeURIComponent(idPart).trim(), params };
}

const PROVIDER_LABEL: Record<string, string> = { microsoft: "Outlook", google: "Google" };

export default function App() {
  const [spaceId, setSpaceId] = useState<string>(() => parseHash().id);
  const [view, setView] = useState<View>("agenda");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [editing, setEditing] = useState<PersonalEvent | "new" | null>(null);
  const [notice, setNotice] = useState<{ kind: "info" | "error"; text: string } | null>(null);

  // React to OAuth return params (#space?connected=…/error=…) then clean them.
  useEffect(() => {
    const apply = () => {
      const { id, params } = parseHash();
      setSpaceId(id);
      const connected = params.get("connected");
      const error = params.get("error");
      if (connected) setNotice({ kind: "info", text: `Connected ${PROVIDER_LABEL[connected] ?? connected}. Events will appear shortly.` });
      else if (error) setNotice({ kind: "error", text: oauthError(error) });
      if ((connected || error) && id) history.replaceState(null, "", `#${id}`);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  useEffect(() => {
    if (spaceId) localStorage.setItem(LS_KEY, spaceId);
  }, [spaceId]);

  const m = useMeridian(spaceId || "__none__", anchor);

  const [winFrom, winTo] = useMemo<[Date, Date]>(() => {
    if (view === "agenda") {
      const s = startOfDay(anchor);
      return [s, addDays(s, 21)];
    }
    if (view === "month") {
      const s = startOfWeek(startOfMonth(anchor));
      return [s, addDays(s, 42)];
    }
    if (view === "week") {
      const s = startOfWeek(anchor);
      return [s, addDays(s, 7)];
    }
    return [startOfMonth(anchor), endOfMonth(anchor)];
  }, [view, anchor]);

  const events: DisplayEvent[] = useMemo(() => {
    if (!m.space) return [];
    const personal = expandPersonal(m.space.events, m.space.categories, winFrom, winTo);
    const feeds = feedToDisplay(m.feedEvents).filter((e) => e.end >= winFrom && e.start <= winTo);
    return [...personal, ...feeds].sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [m.space, m.feedEvents, winFrom, winTo]);

  if (!spaceId) {
    return (
      <SpaceGate
        initial={localStorage.getItem(LS_KEY) ?? ""}
        onPick={(id) => { location.hash = id; setSpaceId(id); }}
      />
    );
  }

  const monthLike = view === "month" || view === "analytics";
  const step = (dir: number) =>
    setAnchor((a) => (monthLike ? new Date(a.getFullYear(), a.getMonth() + dir, 1) : addDays(a, dir * 7)));

  const title =
    view === "settings"
      ? "Settings"
      : monthLike
      ? anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : view === "week"
      ? fmtRangeTitle(startOfWeek(anchor), addDays(startOfWeek(anchor), 6))
      : fmtRangeTitle(startOfDay(anchor), addDays(startOfDay(anchor), 20));

  const openEvent = (ev: DisplayEvent) => {
    if (ev.personalId && m.space) setEditing(findPersonal(m.space.events, ev.personalId));
  };

  return (
    <div className="app">
      <header className="hdr">
        <div className="hdr-top">
          <div className="wordmark">
            <span className="logo" />
            Meridian
            <button className="space-chip" title="Switch calendar" onClick={() => { location.hash = ""; setSpaceId(""); }}>
              {spaceId}
            </button>
          </div>
          <div className="hdr-spacer" />
          {m.refreshing && <span className="sync-dot">syncing</span>}
          <button className={view === "analytics" ? "icon-btn active" : "icon-btn"} title="Insights" onClick={() => setView("analytics")}>
            {IconChart}
          </button>
          <button className={view === "settings" ? "icon-btn active" : "icon-btn"} title="Settings" onClick={() => setView("settings")}>
            {IconGear}
          </button>
          <button className="btn-primary" onClick={() => setEditing("new")}>{IconPlus}<span>New</span></button>
        </div>

        {view !== "settings" && (
          <div className="hdr-bottom">
            <div className="period">{title}</div>
            <div className="navcluster">
              <button className="nav-arrow" aria-label="Previous" onClick={() => step(-1)}>{IconChevL}</button>
              <button className="today-btn" onClick={() => setAnchor(new Date())}>Today</button>
              <button className="nav-arrow" aria-label="Next" onClick={() => step(1)}>{IconChevR}</button>
            </div>
            <div className="hdr-spacer" />
            <div className="segmented">
              {(["agenda", "week", "month"] as View[]).map((v) => (
                <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {notice && <div className={`banner ${notice.kind}`}>{notice.text}<button className="b-link" onClick={() => setNotice(null)}>Dismiss</button></div>}
      {m.error && (
        <div className="banner error">
          Couldn’t reach storage — your Supabase project may be paused. Restore it, then
          <button className="b-link" onClick={m.reloadSpace}>Retry</button>
        </div>
      )}
      {m.feedErrors.length > 0 && (
        <div className="banner warn">
          {m.feedErrors.map((e, i) => (<span key={i}>{e.feed}: {e.message}.&nbsp;</span>))}
        </div>
      )}

      <main className="content">
        {m.loading || !m.space ? (
          <div className="loading">Loading…</div>
        ) : view === "agenda" ? (
          <AgendaView events={events} onPick={openEvent} />
        ) : view === "week" ? (
          <WeekView
            anchor={anchor}
            events={events}
            onPick={openEvent}
            onCreateAt={(start) => setEditing(newAt(start, m.space!.categories[0]?.id ?? "personal"))}
          />
        ) : view === "month" ? (
          <MonthView
            anchor={anchor}
            events={events}
            onPickDay={(d) => { setAnchor(d); setView("agenda"); }}
            onPick={openEvent}
          />
        ) : view === "analytics" ? (
          <Analytics events={events} categories={m.space.categories} from={winFrom} to={winTo} />
        ) : (
          <Settings state={m} spaceId={spaceId} />
        )}
      </main>

      {editing !== null && m.space && (
        <EventModal
          initial={editing === "new" ? newAt(defaultStart(), m.space.categories[0]?.id ?? "personal") : editing}
          categories={m.space.categories}
          onClose={() => setEditing(null)}
          onSave={async (ev) => { await m.upsertEvent(ev); setEditing(null); }}
          onDelete={editing !== "new" ? async (id) => { await m.deleteEvent(id); setEditing(null); } : undefined}
        />
      )}
    </div>
  );
}

function oauthError(code: string): string {
  if (code.endsWith("_not_configured")) {
    const p = code.replace("_not_configured", "");
    return `${PROVIDER_LABEL[p] ?? p} isn’t set up yet — its OAuth credentials aren’t configured.`;
  }
  if (code === "expired_state") return "That sign-in link expired. Please try connecting again.";
  if (code === "no_refresh_token") return "Couldn’t get lasting access — try connecting again and grant offline access.";
  return `Connection failed: ${code}`;
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
  return {
    id: crypto.randomUUID(),
    title: "",
    start: start.toISOString(),
    end: new Date(start.getTime() + 3600_000).toISOString(),
    allDay: false,
    category,
    recurrence: null,
  };
}

// --- inline icons (kept tiny; stroke inherits currentColor) ---
const s = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const IconChevL = (<svg {...s}><polyline points="15 18 9 12 15 6" /></svg>);
const IconChevR = (<svg {...s}><polyline points="9 18 15 12 9 6" /></svg>);
const IconPlus = (<svg {...s} width={16} height={16}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>);
const IconGear = (<svg {...s}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>);
const IconChart = (<svg {...s}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>);
