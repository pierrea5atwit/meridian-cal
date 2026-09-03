import { useState } from "react";
import type { MeridianState } from "../useMeridian";
import type { Category, Connection, Feed, Provider } from "../types";

const PALETTE = ["#4f46e5", "#3fb27f", "#e8833a", "#9b6cf0", "#e05a6d", "#2bb8c4", "#c9a227", "#7a8699"];
const PROVIDER_META: Record<Provider, { label: string; glyph: string; color: string }> = {
  microsoft: { label: "Outlook", glyph: "O", color: "#2b6cb0" },
  google: { label: "Google", glyph: "G", color: "#d9534f" },
};

export default function Settings({ state, spaceId }: { state: MeridianState; spaceId: string }) {
  const space = state.space!;
  const cats = space.categories;

  const connect = (provider: Provider) => {
    const category = provider === "microsoft" ? "work" : "personal";
    window.location.href =
      `/api/oauth-start?provider=${provider}&id=${encodeURIComponent(spaceId)}&category=${category}`;
  };

  const patchConn = (id: string, patch: Partial<Connection>) =>
    state.save((d) => {
      const c = d.connections.find((x) => x.id === id);
      if (c) Object.assign(c, patch);
      return d;
    });

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
    state.save((d) => { d.feeds = d.feeds.filter((x) => x.id !== id); return d; });

  const addCat = () =>
    state.save((d) => {
      d.categories.push({ id: `cat-${Date.now().toString(36)}`, name: "New category", color: PALETTE[d.categories.length % PALETTE.length] });
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
      {/* Connected accounts */}
      <section className="card">
        <div className="card-head"><h2>Connected accounts</h2></div>
        <p className="card-sub">One-click sync from Outlook or Google — no links to copy. Read-only.</p>
        <div className="connect-row">
          {(Object.keys(PROVIDER_META) as Provider[]).map((p) => (
            <button key={p} className="connect-btn" onClick={() => connect(p)}>
              <span className="glyph" style={{ background: PROVIDER_META[p].color }}>{PROVIDER_META[p].glyph}</span>
              Connect {PROVIDER_META[p].label}
            </button>
          ))}
        </div>
        {space.connections.length > 0 && (
          <div className="src-list">
            {space.connections.map((c) => (
              <div className="src-row" key={c.id}>
                <input className="swatch" type="color" value={c.color} onChange={(e) => patchConn(c.id, { color: e.target.value })} />
                <div className="src-fields">
                  <div className="conn-title">
                    <span className="conn-badge" style={{ background: PROVIDER_META[c.provider].color }}>{PROVIDER_META[c.provider].label}</span>
                    {c.email}
                  </div>
                  <div className="src-meta">
                    <select value={c.category} onChange={(e) => patchConn(c.id, { category: e.target.value })}>
                      {cats.map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                    </select>
                    <label className="toggle">
                      <input type="checkbox" checked={c.enabled} onChange={(e) => patchConn(c.id, { enabled: e.target.checked })} /> Enabled
                    </label>
                    <button className="link-danger" onClick={() => state.disconnect(c.id)}>Disconnect</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* .ics feeds */}
      <section className="card">
        <div className="card-head">
          <h2>Calendar feeds</h2>
          <button className="btn-ghost" onClick={addFeed}>+ Add feed</button>
        </div>
        <p className="card-sub">
          Subscribe to a secret <code>.ics</code> URL (Google, Outlook, Apple). Read-only, refreshed ~every 15 min. <FeedHelp />
        </p>
        {space.feeds.length === 0 && <p className="muted small">No feeds yet.</p>}
        <div className="src-list">
          {space.feeds.map((f) => (
            <div className="src-row" key={f.id}>
              <input className="swatch" type="color" value={f.color} onChange={(e) => patchFeed(f.id, { color: e.target.value })} />
              <div className="src-fields">
                <input className="src-name" value={f.name} placeholder="Name (e.g. Class schedule)" onChange={(e) => patchFeed(f.id, { name: e.target.value })} />
                <input className="src-url" value={f.url} placeholder="https://…/basic.ics" spellCheck={false} onChange={(e) => patchFeed(f.id, { url: e.target.value })} />
                <div className="src-meta">
                  <select value={f.category} onChange={(e) => patchFeed(f.id, { category: e.target.value })}>
                    {cats.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                  <label className="toggle">
                    <input type="checkbox" checked={f.enabled} onChange={(e) => patchFeed(f.id, { enabled: e.target.checked })} /> Enabled
                  </label>
                  <button className="link-danger" onClick={() => removeFeed(f.id)}>Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {(space.feeds.length > 0 || space.connections.length > 0) && (
          <button className="btn-ghost" style={{ marginTop: 12 }} onClick={state.reloadFeeds}>↻ Refresh now</button>
        )}
      </section>

      {/* Categories */}
      <section className="card">
        <div className="card-head">
          <h2>Categories</h2>
          <button className="btn-ghost" onClick={addCat}>+ Add</button>
        </div>
        <p className="card-sub">Color your events and group time analytics.</p>
        <div className="cat-list">
          {cats.map((c) => (
            <div className="cat-row" key={c.id}>
              <input className="swatch" type="color" value={c.color} onChange={(e) => patchCat(c.id, { color: e.target.value })} />
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
      <button className="link" onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Where do I find it?"}</button>
      {open && (
        <div className="help-box">
          <p><b>Google:</b> Settings → “Settings for my calendars” → a calendar → “Integrate calendar” → <b>Secret address in iCal format</b>.</p>
          <p><b>Outlook:</b> Calendar → Settings → “Shared calendars” → “Publish a calendar” → copy the <b>ICS</b> link.</p>
          <p className="muted">Keep these URLs private — anyone with the link can read that calendar.</p>
        </div>
      )}
    </>
  );
}
