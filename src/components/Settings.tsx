import { useState } from "react";
import type { MeridianState } from "../useMeridian";
import type { Category, Feed } from "../types";

const PALETTE = ["#5b8def", "#3fb27f", "#e8833a", "#9b6cf0", "#e05a6d", "#2bb8c4", "#c9a227", "#7a8699"];

export default function Settings({ state }: { state: MeridianState }) {
  const space = state.space!;
  const cats = space.categories;

  const addFeed = () =>
    state.save((d) => {
      d.feeds.push({
        id: crypto.randomUUID(),
        name: "New feed",
        url: "",
        color: PALETTE[d.feeds.length % PALETTE.length],
        category: cats[0]?.id ?? "personal",
        enabled: true,
      });
      return d;
    });

  const patchFeed = (id: string, patch: Partial<Feed>) =>
    state.save((d) => {
      const f = d.feeds.find((x) => x.id === id);
      if (f) Object.assign(f, patch);
      return d;
    });

  const removeFeed = (id: string) =>
    state.save((d) => {
      d.feeds = d.feeds.filter((x) => x.id !== id);
      return d;
    });

  const addCat = () =>
    state.save((d) => {
      const id = `cat-${Date.now().toString(36)}`;
      d.categories.push({ id, name: "New category", color: PALETTE[d.categories.length % PALETTE.length] });
      return d;
    });

  const patchCat = (id: string, patch: Partial<Category>) =>
    state.save((d) => {
      const c = d.categories.find((x) => x.id === id);
      if (c) Object.assign(c, patch);
      return d;
    });

  return (
    <div className="settings">
      <section>
        <div className="sec-head">
          <h2>Calendar feeds</h2>
          <button className="add-btn" onClick={addFeed}>+ Add feed</button>
        </div>
        <p className="muted small">
          Paste the secret <code>.ics</code> URL from Google or Outlook. Read-only, refreshed
          every ~15 min. <FeedHelp />
        </p>
        {space.feeds.length === 0 && <p className="muted">No feeds yet.</p>}
        <div className="feed-list">
          {space.feeds.map((f) => (
            <div className="feed-row" key={f.id}>
              <input
                className="swatch"
                type="color"
                value={f.color}
                onChange={(e) => patchFeed(f.id, { color: e.target.value })}
                title="Color"
              />
              <div className="feed-fields">
                <input
                  className="feed-name"
                  value={f.name}
                  placeholder="Name (e.g. Outlook — School)"
                  onChange={(e) => patchFeed(f.id, { name: e.target.value })}
                />
                <input
                  className="feed-url"
                  value={f.url}
                  placeholder="https://…/basic.ics  or  webcal://…"
                  onChange={(e) => patchFeed(f.id, { url: e.target.value })}
                  spellCheck={false}
                />
                <div className="feed-meta">
                  <select value={f.category} onChange={(e) => patchFeed(f.id, { category: e.target.value })}>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={f.enabled}
                      onChange={(e) => patchFeed(f.id, { enabled: e.target.checked })}
                    />
                    Enabled
                  </label>
                  <button className="link-danger" onClick={() => removeFeed(f.id)}>Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {space.feeds.length > 0 && (
          <button className="ghost" onClick={state.reloadFeeds}>↻ Refresh feeds now</button>
        )}
      </section>

      <section>
        <div className="sec-head">
          <h2>Categories</h2>
          <button className="add-btn" onClick={addCat}>+ Add category</button>
        </div>
        <p className="muted small">Used to color personal events and group time analytics.</p>
        <div className="cat-list">
          {cats.map((c) => (
            <div className="cat-row" key={c.id}>
              <input
                className="swatch"
                type="color"
                value={c.color}
                onChange={(e) => patchCat(c.id, { color: e.target.value })}
              />
              <input value={c.name} onChange={(e) => patchCat(c.id, { name: e.target.value })} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function FeedHelp() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="link" onClick={() => setOpen((o) => !o)}>
        {open ? "Hide" : "Where do I find it?"}
      </button>
      {open && (
        <div className="help-box">
          <p><b>Google Calendar:</b> Settings → “Settings for my calendars” → pick a calendar →
            “Integrate calendar” → copy the <b>Secret address in iCal format</b>.</p>
          <p><b>Outlook / Microsoft 365:</b> Calendar → Settings → “Shared calendars” →
            “Publish a calendar” → publish → copy the <b>ICS</b> link.</p>
          <p className="muted">Keep these URLs private — anyone with the link can read that calendar.</p>
        </div>
      )}
    </>
  );
}
