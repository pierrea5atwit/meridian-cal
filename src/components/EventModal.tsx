import { useState } from "react";
import type { Category, PersonalEvent, Recurrence } from "../types";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toDateInput(iso: string): string {
  return toLocalInput(iso).slice(0, 10);
}
function fromLocalInput(v: string): string {
  return new Date(v).toISOString();
}

export default function EventModal({
  initial,
  categories,
  onClose,
  onSave,
  onDelete,
}: {
  initial: PersonalEvent;
  categories: Category[];
  onClose: () => void;
  onSave: (ev: PersonalEvent) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
}) {
  const [ev, setEv] = useState<PersonalEvent>(initial);
  const [saving, setSaving] = useState(false);
  const rec = ev.recurrence ?? null;

  const set = (patch: Partial<PersonalEvent>) => setEv((e) => ({ ...e, ...patch }));

  const setRec = (next: Recurrence | null) => set({ recurrence: next });
  const toggleDay = (day: number) => {
    const base: Recurrence = rec ?? { freq: "weekly", days: [], until: null };
    const days = base.days.includes(day)
      ? base.days.filter((d) => d !== day)
      : [...base.days, day].sort();
    setRec({ ...base, days });
  };

  const valid = ev.title.trim().length > 0 && new Date(ev.end) > new Date(ev.start);

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    await onSave({ ...ev, title: ev.title.trim() });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <input
          className="modal-title"
          autoFocus
          placeholder="Event title"
          value={ev.title}
          onChange={(e) => set({ title: e.target.value })}
        />

        <label className="field">
          <span>Category</span>
          <select value={ev.category} onChange={(e) => set({ category: e.target.value })}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="field inline">
          <input
            type="checkbox"
            checked={ev.allDay}
            onChange={(e) => set({ allDay: e.target.checked })}
          />
          <span>All day</span>
        </label>

        <div className="field-grid">
          <label className="field">
            <span>Starts</span>
            {ev.allDay ? (
              <input
                type="date"
                value={toDateInput(ev.start)}
                onChange={(e) => set({ start: fromLocalInput(e.target.value + "T00:00") })}
              />
            ) : (
              <input
                type="datetime-local"
                value={toLocalInput(ev.start)}
                onChange={(e) => set({ start: fromLocalInput(e.target.value) })}
              />
            )}
          </label>
          <label className="field">
            <span>Ends</span>
            {ev.allDay ? (
              <input
                type="date"
                value={toDateInput(ev.end)}
                onChange={(e) => set({ end: fromLocalInput(e.target.value + "T23:59") })}
              />
            ) : (
              <input
                type="datetime-local"
                value={toLocalInput(ev.end)}
                onChange={(e) => set({ end: fromLocalInput(e.target.value) })}
              />
            )}
          </label>
        </div>

        <div className="field">
          <label className="inline">
            <input
              type="checkbox"
              checked={!!rec}
              onChange={(e) => setRec(e.target.checked ? { freq: "weekly", days: [new Date(ev.start).getDay()], until: null } : null)}
            />
            <span>Repeats weekly</span>
          </label>
          {rec && (
            <div className="recur">
              <div className="dow-row">
                {DOW.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    className={rec.days.includes(i) ? "dow on" : "dow"}
                    onClick={() => toggleDay(i)}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <label className="field">
                <span>Until (optional)</span>
                <input
                  type="date"
                  value={rec.until ? rec.until.slice(0, 10) : ""}
                  onChange={(e) => setRec({ ...rec, until: e.target.value ? new Date(e.target.value + "T23:59").toISOString() : null })}
                />
              </label>
            </div>
          )}
        </div>

        <label className="field">
          <span>Notes</span>
          <textarea
            rows={2}
            value={ev.notes ?? ""}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </label>

        <div className="modal-actions">
          {onDelete && (
            <button className="link-danger" onClick={() => onDelete(ev.id)}>Delete</button>
          )}
          <div className="spacer" />
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!valid || saving} onClick={submit}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
