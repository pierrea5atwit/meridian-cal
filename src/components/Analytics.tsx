import { useMemo } from "react";
import type { Category, DisplayEvent } from "../types";
import { categoryColor, categoryName } from "../dates";

export default function Analytics({
  events,
  categories,
  from,
  to,
}: {
  events: DisplayEvent[];
  categories: Category[];
  from: Date;
  to: Date;
}) {
  const stats = useMemo(() => {
    const byCat = new Map<string, number>(); // category id -> ms
    let totalMs = 0;
    for (const e of events) {
      if (e.allDay) continue;
      const s = Math.max(e.start.getTime(), from.getTime());
      const en = Math.min(e.end.getTime(), to.getTime());
      const ms = Math.max(0, en - s);
      if (ms === 0) continue;
      byCat.set(e.categoryId, (byCat.get(e.categoryId) ?? 0) + ms);
      totalMs += ms;
    }
    const rows = [...byCat.entries()]
      .map(([id, ms]) => ({ id, hours: ms / 3.6e6, pct: totalMs ? (ms / totalMs) * 100 : 0 }))
      .sort((a, b) => b.hours - a.hours);
    return { rows, totalHours: totalMs / 3.6e6 };
  }, [events, from, to]);

  const max = Math.max(1, ...stats.rows.map((r) => r.hours));

  return (
    <div className="analytics">
      <div className="an-summary">
        <div className="an-big">{stats.totalHours.toFixed(1)}<span>h</span></div>
        <div className="an-sub">scheduled this period · {stats.rows.length} categories</div>
      </div>

      {stats.rows.length === 0 ? (
        <p className="muted">No timed events in this range yet.</p>
      ) : (
        <div className="an-bars">
          {stats.rows.map((r) => (
            <div key={r.id} className="an-row">
              <div className="an-label">
                <span className="ev-dot" style={{ background: categoryColor(categories, r.id) }} />
                {categoryName(categories, r.id)}
              </div>
              <div className="an-track">
                <div
                  className="an-fill"
                  style={{ width: `${(r.hours / max) * 100}%`, background: categoryColor(categories, r.id) }}
                />
              </div>
              <div className="an-value">
                {r.hours.toFixed(1)}h <span className="muted">({r.pct.toFixed(0)}%)</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="muted small">All-day events are excluded from hour totals.</p>
    </div>
  );
}
