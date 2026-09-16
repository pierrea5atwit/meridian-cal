import { useEffect, useRef, useState, type CSSProperties } from "react";

export type Kind = "speech" | "music";

const N_BARS = 56;

export default function DropZone({
  kind,
  color,
  onChange,
}: {
  kind: Kind;
  color: string;
  onChange: (f: File | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string>("");
  const [peaks, setPeaks] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);

  const label = kind === "speech" ? "Speech" : "Music";
  const hint = kind === "speech" ? "A voice, podcast, or vocal take" : "A beat, song, or instrumental";

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
      cancelAnimationFrame(rafRef.current);
    },
    [url],
  );

  async function ingest(f: File) {
    setError("");
    if (!f.type.startsWith("audio")) {
      setError("That doesn’t look like an audio file.");
      return;
    }
    if (url) URL.revokeObjectURL(url);
    const objectUrl = URL.createObjectURL(f);
    setFile(f);
    setUrl(objectUrl);
    setPlaying(false);
    setProgress(0);
    setPeaks([]);
    setDuration(0);
    onChange(f);
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const decoded = await ctx.decodeAudioData(await f.arrayBuffer());
      setDuration(decoded.duration);
      setPeaks(computePeaks(decoded, N_BARS));
      ctx.close();
    } catch {
      // Some codecs won't decode in-browser — fall back to a gentle placeholder.
      setPeaks(Array.from({ length: N_BARS }, (_, i) => 0.3 + 0.55 * Math.abs(Math.sin(i / 4))));
    }
  }

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
      setPlaying(true);
      tick();
    } else {
      a.pause();
      setPlaying(false);
    }
  }
  function tick() {
    const a = audioRef.current;
    if (!a) return;
    setProgress(a.duration ? a.currentTime / a.duration : 0);
    if (!a.paused && !a.ended) rafRef.current = requestAnimationFrame(tick);
  }
  function seek(fraction: number) {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    a.currentTime = fraction * a.duration;
    setProgress(fraction);
  }
  function clear() {
    if (url) URL.revokeObjectURL(url);
    setFile(null);
    setUrl("");
    setPeaks([]);
    setPlaying(false);
    setProgress(0);
    onChange(null);
  }

  const inputId = `pick-${kind}`;

  return (
    <div
      className={`zone${dragOver ? " over" : ""}${file ? " filled" : ""}`}
      style={{ "--c": color } as CSSProperties}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void ingest(f);
      }}
    >
      <div className="zone-head">
        <span className="zone-icon" style={{ background: color }}>{kind === "speech" ? MicIcon : NoteIcon}</span>
        <span className="zone-label">{label}</span>
      </div>

      {!file ? (
        <label htmlFor={inputId} className="zone-empty">
          <div className="zone-plus">{PlusIcon}</div>
          <div className="zone-cta">Drop audio here <span>or browse</span></div>
          <div className="zone-hint">{hint}</div>
          {error && <div className="zone-err">{error}</div>}
        </label>
      ) : (
        <div className="zone-loaded">
          <div className="wave" onClick={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            seek((e.clientX - r.left) / r.width);
          }}>
            {peaks.length === 0
              ? <div className="wave-loading">reading waveform…</div>
              : peaks.map((p, i) => (
                  <span
                    key={i}
                    className={i / peaks.length <= progress ? "bar on" : "bar"}
                    style={{ height: `${8 + p * 92}%` }}
                  />
                ))}
          </div>
          <div className="zone-foot">
            <button className="play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
              {playing ? PauseIcon : PlayIcon}
            </button>
            <div className="meta">
              <div className="fname" title={file.name}>{file.name}</div>
              <div className="fmeta">{fmtTime(progress * duration)} / {fmtTime(duration)}</div>
            </div>
            <button className="remove" onClick={clear} aria-label="Remove">{XIcon}</button>
          </div>
        </div>
      )}

      <input
        id={inputId}
        type="file"
        accept="audio/*"
        hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void ingest(f); }}
      />
      {url && <audio ref={audioRef} src={url} onEnded={() => { setPlaying(false); setProgress(1); }} />}
    </div>
  );
}

function computePeaks(buf: AudioBuffer, n: number): number[] {
  const data = buf.getChannelData(0);
  const block = Math.max(1, Math.floor(data.length / n));
  const peaks: number[] = [];
  let max = 0;
  for (let i = 0; i < n; i++) {
    let p = 0;
    for (let j = 0; j < block; j++) {
      const v = Math.abs(data[i * block + j] || 0);
      if (v > p) p = v;
    }
    peaks.push(p);
    if (p > max) max = p;
  }
  return peaks.map((p) => (max ? p / max : 0));
}

function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// --- inline icons ---
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const MicIcon = (<svg width="15" height="15" viewBox="0 0 24 24" {...stroke}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4" /></svg>);
const NoteIcon = (<svg width="15" height="15" viewBox="0 0 24 24" {...stroke}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>);
const PlusIcon = (<svg width="26" height="26" viewBox="0 0 24 24" {...stroke}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>);
const PlayIcon = (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>);
const PauseIcon = (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>);
const XIcon = (<svg width="15" height="15" viewBox="0 0 24 24" {...stroke}><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>);
