import { useMemo } from "react";
import { addDays, fmtTime, isToday, sameDay, startOfWeek } from "../dates";
import type { DisplayEvent } from "../types";

const HOUR_PX = 48;
const DAY_PX = HOUR_PX * 24;

interface Placed {
  ev: DisplayEvent;
  lane: number;
  lanes: number;
}

/** Greedy lane packing so overlapping events sit side-by-side. */
function packDay(events: DisplayEvent[]): Placed[] {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const laneEnds: number[] = [];
  const placed: { ev: DisplayEvent; lane: number }[] = [];
  for (const ev of sorted) {
    let lane = laneEnds.findIndex((end) => end <= ev.start.getTime());
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = ev.end.getTime();
    placed.push({ ev, lane });
  }
  const lanes = Math.max(1, laneEnds.length);
  return placed.map((p) => ({ ...p, lanes }));
}

export default function WeekView({
  anchor,
  events,
  onPick,
  onCreateAt,
}: {
  anchor: Date;
  events: DisplayEvent[];
  onPick: (ev: DisplayEvent) => void;
  onCreateAt: (start: Date) => void;
}) {
  const weekStart = startOfWeek(anchor);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const allDay = events.filter((e) => e.allDay);
  const timed = events.filter((e) => !e.allDay);

  return (
    <div className="week">
      <div className="week-head">
        <div className="gutter-head" />
        {days.map((d) => (
          <div key={d.toISOString()} className={isToday(d) ? "day-head today" : "day-head"}>
            <span className="dow">{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
            <span className="dnum">{d.getDate()}</span>
          </div>
        ))}
      </div>

      {allDay.length > 0 && (
        <div className="allday-row">
          <div className="gutter-head small">all-day</div>
          {days.map((d) => (
            <div key={d.toISOString()} className="allday-cell">
              {allDay
                .filter((e) => e.start <= endOf(d) && e.end >= startOf(d))
                .map((e) => (
                  <button
                    key={e.key}
                    className="chip allday"
                    style={{ background: e.color }}
                    onClick={() => onPick(e)}
                    title={`${e.title} — ${e.sourceLabel}`}
                  >
                    {e.title}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}

      <div className="week-body">
        <div className="time-gutter">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="hour-label" style={{ height: HOUR_PX }}>
              {h === 0 ? "" : formatHour(h)}
            </div>
          ))}
        </div>
        {days.map((d) => {
          const dayEvents = timed.filter((e) => sameDay(e.start, d));
          const placed = packDay(dayEvents);
          return (
            <div
              key={d.toISOString()}
              className="day-col"
              style={{ height: DAY_PX }}
              onClick={(e) => {
                if (e.target !== e.currentTarget) return;
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const minutes = Math.floor(((e.clientY - rect.top) / DAY_PX) * 1440 / 15) * 15;
                const start = new Date(d);
                start.setHours(0, minutes, 0, 0);
                onCreateAt(start);
              }}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="hour-line" style={{ top: h * HOUR_PX }} />
              ))}
              {isToday(d) && <NowLine />}
              {placed.map(({ ev, lane, lanes }) => {
                const top = minutesFromMidnight(ev.start) / 1440 * DAY_PX;
                const rawH = (ev.end.getTime() - ev.start.getTime()) / 60000 / 1440 * DAY_PX;
                const height = Math.max(18, rawH);
                const width = 100 / lanes;
                return (
                  <button
                    key={ev.key}
                    className="event"
                    style={{
                      top,
                      height,
                      left: `${lane * width}%`,
                      width: `calc(${width}% - 3px)`,
                      background: ev.color,
                      opacity: ev.editable ? 1 : 0.88,
                    }}
                    onClick={(e) => { e.stopPropagation(); onPick(ev); }}
                    title={`${ev.title} — ${ev.sourceLabel}`}
                  >
                    <span className="ev-title">{ev.title}</span>
                    <span className="ev-time">{fmtTime(ev.start)}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NowLine() {
  const now = new Date();
  const top = minutesFromMidnight(now) / 1440 * DAY_PX;
  return <div className="now-line" style={{ top }} />;
}

function minutesFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}
function startOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function formatHour(h: number): string {
  const ampm = h < 12 ? "am" : "pm";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${ampm}`;
}
