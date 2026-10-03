import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, Link2, MonitorUp, Search, Video, X } from "lucide-react";

/* ---------------- Air cursor ---------------- */
export function AirCursor({ tool }: { tool: string }) {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [down, setDown] = useState(false);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    setEnabled(true);
    document.documentElement.classList.add("air-cursor-on");
    let x = -100, y = -100, rx = -100, ry = -100, raf = 0;
    const move = (e: PointerEvent) => { x = e.clientX; y = e.clientY; };
    const loop = () => {
      rx += (x - rx) * 0.22; ry += (y - ry) * 0.22;
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    const pd = () => setDown(true);
    const pu = () => setDown(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", pd);
    window.addEventListener("pointerup", pu);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", pd);
      window.removeEventListener("pointerup", pu);
      document.documentElement.classList.remove("air-cursor-on");
    };
  }, []);

  if (!enabled || tool === "laser") return null;
  const color = tool === "pen" ? "bg-ink" : tool === "eraser" ? "bg-destructive" : "bg-softblue";
  return (
    <>
      <div ref={ring} className="pointer-events-none fixed left-0 top-0 z-[100]">
        <div className={`-ml-5 -mt-5 size-10 rounded-full border border-softblue/50 bg-softblue/5 backdrop-blur-[1px] transition-transform duration-150 ${down ? "scale-75" : tool === "text" ? "scale-125" : ""}`} />
      </div>
      <div ref={dot} className="pointer-events-none fixed left-0 top-0 z-[101]">
        <div className={`-ml-1 -mt-1 size-2 rounded-full ${color} shadow-[0_0_10px_2px_var(--softblue)]`} />
      </div>
    </>
  );
}

/* ---------------- Media pane (split screen) ---------------- */
type Source = "camera" | "screen" | "video";

function toEmbed(url: string) {
  const yt = url.match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{11})/);
  if (yt) return { kind: "iframe" as const, src: `https://www.youtube.com/embed/${yt[1]}` };
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { kind: "iframe" as const, src: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return { kind: "video" as const, src: url };
  return { kind: "iframe" as const, src: url };
}

export function MediaPane({ onClose }: { onClose: () => void }) {
  const [source, setSource] = useState<Source>("video");
  const [url, setUrl] = useState("");
  const [embed, setEmbed] = useState<ReturnType<typeof toEmbed> | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, [stream]);
  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  const start = async (next: Source) => {
    setSource(next);
    setError("");
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    if (next === "video") return;
    try {
      const s = next === "camera" ? await navigator.mediaDevices.getUserMedia({ video: true, audio: false }) : await navigator.mediaDevices.getDisplayMedia({ video: true });
      setStream(s);
    } catch {
      setError(next === "camera" ? "Camera permission was blocked." : "Screen sharing was cancelled.");
    }
  };

  return (
    <aside className="air-pop flex h-full flex-col gap-3 border-l border-glass-border bg-paper p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-extrabold">Live screen</p>
        <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={onClose} aria-label="Close split screen"><X /></Button>
      </div>
      <div className="flex gap-1 rounded-full bg-muted p-1">
        {([["video", "Video", Video], ["camera", "Camera", Camera], ["screen", "Share screen", MonitorUp]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => void start(id)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-semibold transition ${source === id ? "bg-background shadow-soft" : "text-cool"}`}><Icon className="size-3.5" />{label}</button>
        ))}
      </div>
      {source === "video" && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (url.trim()) setEmbed(toEmbed(url.trim())); }}>
          <div className="flex flex-1 items-center gap-2 rounded-xl bg-muted px-3"><Link2 className="size-3.5 text-cool" /><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a YouTube, Vimeo or video link" className="h-9 w-full bg-transparent text-xs outline-none" /></div>
          <Button size="sm" type="submit" className="rounded-xl">Play</Button>
        </form>
      )}
      <div className="relative flex-1 overflow-hidden rounded-3xl bg-ink">
        {source === "video" && embed?.kind === "iframe" && <iframe title="Shared video" src={embed.src} className="size-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />}
        {source === "video" && embed?.kind === "video" && <video src={embed.src} controls className="size-full object-contain" />}
        {source !== "video" && stream && <video ref={videoRef} autoPlay muted playsInline className={`size-full ${source === "camera" ? "object-cover -scale-x-100" : "object-contain"}`} />}
        {((source === "video" && !embed) || (source !== "video" && !stream)) && (
          <div className="grid size-full place-items-center p-6 text-center text-sm text-paper/70">
            {error || (source === "video" ? "Play a lesson video or product demo next to your board." : "Starting…")}
            {source !== "video" && !stream && <Button variant="glass" size="sm" className="mt-3 rounded-full" onClick={() => void start(source)}>Try again</Button>}
          </div>
        )}
      </div>
    </aside>
  );
}

/* ---------------- Presenter camera bubble ---------------- */
export function CameraBubble({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [pos, setPos] = useState({ x: 24, y: 96 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    let s: MediaStream | null = null;
    navigator.mediaDevices?.getUserMedia({ video: true }).then((stream) => { s = stream; if (ref.current) ref.current.srcObject = stream; }).catch(() => setFailed(true));
    return () => s?.getTracks().forEach((t) => t.stop());
  }, []);
  return (
    <div
      className="air-pop fixed z-50 size-40 overflow-hidden rounded-full bg-ink shadow-glass ring-4 ring-paper"
      style={{ right: pos.x, top: pos.y }}
      onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { const d = drag.current; if (!d) return; setPos((p) => ({ x: p.x - (e.clientX - d.x), y: p.y + (e.clientY - d.y) })); drag.current = { x: e.clientX, y: e.clientY }; }}
      onPointerUp={() => { drag.current = null; }}
    >
      {failed ? <div className="grid size-full place-items-center text-paper/70"><CameraOff /></div> : <video ref={ref} autoPlay muted playsInline className="size-full -scale-x-100 object-cover" />}
      <button type="button" onClick={onClose} aria-label="Close camera" className="absolute right-6 top-3 grid size-6 place-items-center rounded-full bg-ink/60 text-paper"><X className="size-3" /></button>
    </div>
  );
}

/* ---------------- Command palette ---------------- */
export type Command = { id: string; group: string; label: string; hint?: string; ai?: boolean; run: () => void };

export function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const filtered = useMemo(() => commands.filter((c) => `${c.group} ${c.label} ${c.hint ?? ""}`.toLowerCase().includes(q.toLowerCase())), [commands, q]);
  const groups = useMemo(() => Array.from(new Set(filtered.map((c) => c.group))), [filtered]);
  const run = (c?: Command) => { if (!c) return; onClose(); c.run(); };
  const aiCount = commands.filter((c) => c.ai).length;
  return (
    <div className="absolute inset-0 z-[60] grid place-items-start justify-center bg-ink/20 px-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <section className="air-pop w-[min(36rem,100%)] overflow-hidden rounded-[28px] glass-surface shadow-glass ring-1 ring-glass-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-glass-border px-5">
          <Search className="size-4 text-cool" />
          <input
            autoFocus value={q}
            onChange={(e) => { setQ(e.target.value); setIndex(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(filtered.length - 1, i + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
              if (e.key === "Enter") run(filtered[index]);
              if (e.key === "Escape") onClose();
            }}
            placeholder={`Search ${commands.length} tools — ${aiCount} are AI…`}
            className="h-14 w-full bg-transparent text-sm outline-none"
          />
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {groups.map((g) => (
            <div key={g} className="mb-1">
              <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-cool">{g}</p>
              {filtered.filter((c) => c.group === g).map((c) => {
                const i = filtered.indexOf(c);
                return (
                  <button key={c.id} type="button" onMouseEnter={() => setIndex(i)} onClick={() => run(c)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${i === index ? "bg-softblue/12 text-softblue" : ""}`}>
                    <span className="flex items-center gap-2">{c.ai && <span className="rounded-full bg-softblue px-1.5 py-0.5 text-[9px] font-bold text-paper">AI</span>}{c.label}</span>
                    {c.hint && <span className="text-[11px] text-cool">{c.hint}</span>}
                  </button>
                );
              })}
            </div>
          ))}
          {!filtered.length && <p className="p-6 text-center text-sm text-cool">No tool found.</p>}
        </div>
      </section>
    </div>
  );
}

/* ---------------- Floating reactions ---------------- */
export function Reactions({ items }: { items: { id: string; emoji: string; x: number }[] }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {items.map((r) => <span key={r.id} className="air-reaction absolute bottom-20 text-4xl" style={{ left: `${r.x}%` }}>{r.emoji}</span>)}
    </div>
  );
}
