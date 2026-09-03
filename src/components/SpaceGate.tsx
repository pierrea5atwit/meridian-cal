import { useState } from "react";

export default function SpaceGate({
  initial,
  onPick,
}: {
  initial: string;
  onPick: (id: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const clean = value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64);

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="wordmark">
          <span className="logo" /> Meridian
        </div>
        <p>
          Your calendars, in one place. Pick a name for your space — bookmark the URL
          and open it on any device to see the same calendar.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (clean) onPick(clean);
          }}
        >
          <input
            autoFocus
            placeholder="e.g. andrew"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button className="btn-primary" type="submit" disabled={!clean}>
            Open
          </button>
        </form>
        {clean && (
          <p className="small" style={{ margin: "12px 0 0" }}>
            Opens <code>#{clean}</code>
          </p>
        )}
      </div>
    </div>
  );
}
