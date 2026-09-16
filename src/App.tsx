import { useEffect, useState } from "react";
import DropZone from "./DropZone";

const SPEECH = "#22d3ee";
const MUSIC = "#a855f7";

export default function App() {
  const [speech, setSpeech] = useState<File | null>(null);
  const [music, setMusic] = useState<File | null>(null);
  const [toast, setToast] = useState<string>("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const both = !!speech && !!music;

  const merge = () => {
    if (!both) {
      setToast("Drop both a speech track and a music track first.");
      return;
    }
    setToast("Merging engine is coming soon — this is an early prototype. ✨");
  };

  return (
    <div className="page">
      <div className="glow" aria-hidden />
      <header className="top">
        <div className="brand">
          <span className="mark" />
          Cadence
          <span className="pill">prototype</span>
        </div>
      </header>

      <main className="hero">
        <h1>
          Merge <span className="grad-a">speech</span> and <span className="grad-b">music</span>.
        </h1>
        <p className="sub">
          Drop a spoken track and a musical track to blend them into one.
          Drag &amp; drop below to try the interface — the merging engine is on its way.
        </p>

        <div className="studio">
          <DropZone kind="speech" color={SPEECH} onChange={setSpeech} />
          <div className="joiner" aria-hidden>
            <span className="joiner-line" />
            <span className="joiner-glyph">＋</span>
            <span className="joiner-line" />
          </div>
          <DropZone kind="music" color={MUSIC} onChange={setMusic} />
        </div>

        <button className={`merge${both ? " ready" : ""}`} onClick={merge}>
          {MergeIcon}
          <span>Merge tracks</span>
        </button>
        <div className="status">
          {both ? "Two tracks ready." : "Add a speech and a music track to enable merging."}
        </div>
      </main>

      <footer className="foot">
        Cadence · early prototype · <span className="mono">meridian-two-eta.vercel.app</span>
      </footer>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

const MergeIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 3v5a5 5 0 0 0 5 5 5 5 0 0 1 5 5v3" />
    <path d="M17 3v5a5 5 0 0 1-5 5" />
    <polyline points="14 18 17 21 20 18" />
  </svg>
);
