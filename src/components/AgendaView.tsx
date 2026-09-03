import { useMemo } from "react";
import { fmtTime, isToday, startOfDay } from "../dates";
import type { DisplayEvent } from "../types";

export default function AgendaView({
  events,
  onPick,
}: {
  events: DisplayEvent[];
  onPick: (ev: DisplayEvent) => void;
}) {
  // Group into days that actually have events; keep chronological order.
  const days = useMemo(() => {
    const buckets = new Map<number, { date: Date; events: DisplayEvent[] }>();
    for (const ev of [...events].sort((a, b) => a.start.getTime() - b.start.getTime())) {
      const key = startOfDay(ev.start).getTime();
      if (!buckets.has(key)) buckets.set(key, { date: startOfDay(ev.start), events: [] });
      buckets.get(key)!.events.push(ev);
    }
    return [...buckets.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events]);

  if (days.length === 0) {
    return (
      <div className="agenda">
        <div className="agenda-empty">
          <div className="big">Nothing scheduled</div>
          <div>Connect a calendar or add an event to see it here.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="agenda">
      {days.map(({ date, events }) => (
        <div className="agenda-day" key={date.getTime()}>
          <div className={isToday(date) ? "agenda-date today" : "agenda-date"}>
            <div className="agenda-dow">{date.toLocaleDateString(undefined, { weekday: "short" })}</div>
            <div className="agenda-dnum">{date.getDate()}</div>
          </div>
          <div className="agenda-events">
            {events.map((e) => (
              <button
                key={e.key}
                className={e.editable ? "ev-card" : "ev-card readonly"}
                onClick={() => onPick(e)}
              >
                <span className="accent" style={{ background: e.color }} />
                <span className="body">
                  <span className="ev-t">{e.title}</span>
                  <span className="ev-meta">
                    <span className="ev-time">
                      {e.allDay ? "All day" : `${fmtTime(e.start)} – ${fmtTime(e.end)}`}
                    </span>
                    <span className="ev-src">{e.sourceLabel}</span>
                    {e.location && <span className="ev-src">· {e.location}</span>}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
