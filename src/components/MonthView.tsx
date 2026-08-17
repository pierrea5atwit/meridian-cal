import { useMemo } from "react";
import { addDays, isToday, sameDay, startOfMonth, startOfWeek } from "../dates";
import type { DisplayEvent } from "../types";

export default function MonthView({
  anchor,
  events,
  onPickDay,
  onPick,
}: {
  anchor: Date;
  events: DisplayEvent[];
  onPickDay: (d: Date) => void;
  onPick: (ev: DisplayEvent) => void;
}) {
  const gridStart = startOfWeek(startOfMonth(anchor));
  const cells = useMemo(
    () => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)),
    [gridStart],
  );
  const month = anchor.getMonth();

  return (
    <div className="month">
      <div className="month-dow">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="month-grid">
        {cells.map((d) => {
          const dayEvents = events
            .filter((e) => sameDay(e.start, d))
            .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime());
          const muted = d.getMonth() !== month;
          return (
            <div key={d.toISOString()} className={`month-cell${muted ? " muted" : ""}`}>
              <button
                className={isToday(d) ? "month-daynum today" : "month-daynum"}
                onClick={() => onPickDay(d)}
              >
                {d.getDate()}
              </button>
              <div className="month-events">
                {dayEvents.slice(0, 4).map((e) => (
                  <button
                    key={e.key}
                    className="month-ev"
                    onClick={() => onPick(e)}
                    title={`${e.title} — ${e.sourceLabel}`}
                  >
                    <span className="ev-dot" style={{ background: e.color }} />
                    <span className="ev-label">
                      {!e.allDay && (
                        <span className="ev-t">
                          {e.start.toLocaleTimeString(undefined, { hour: "numeric" })}{" "}
                        </span>
                      )}
                      {e.title}
                    </span>
                  </button>
                ))}
                {dayEvents.length > 4 && (
                  <button className="month-more" onClick={() => onPickDay(d)}>
                    +{dayEvents.length - 4} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
