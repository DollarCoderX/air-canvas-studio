import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowUp,
  Building2,
  Check,
  ChevronDown,
  Copy,
  Download,
  FilePlus2,
  GraduationCap,
  ImagePlus,
  LayoutTemplate,
  Loader2,
  MousePointer2,
  Pause,
  PenLine,
  Play,
  Plus,
  Presentation,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Users,
  WandSparkles,
  X,
  Zap,
  Eraser,
  Command,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  type BoardItem,
  type BoardMessage,
  type BoardStroke,
  type BoardThread,
  type NoteColor,
  type WorkspaceMode,
  createThread,
  ensureThreads,
  makeId,
  makeMessage,
  nanoReply,
  readThreads,
  writeThreads,
} from "@/lib/board-storage";
import { templateItems, templatesByMode } from "@/lib/board-templates";
import { askPollinations, pollinationsImageUrl } from "@/lib/pollinations";
import { AirCursor, CameraBubble, CommandPalette, MediaPane, Reactions, type Command as PaletteCommand } from "@/components/board-extras";

type Tool = "select" | "text" | "pen" | "laser" | "eraser";
type Panel = "none" | "ai" | "templates";

const modeMeta: Record<WorkspaceMode, { label: string; icon: typeof Users; hint: string; actions: { label: string; prompt: string; image?: boolean }[] }> = {
  school: {
    label: "Classroom",
    icon: GraduationCap,
    hint: "Pick a lesson template, write with the pen, and press Present on the projector.",
    actions: [
      { label: "Explain simply", prompt: "Explain the topic on this board simply for students, in 4 short lines." },
      { label: "Make a quiz", prompt: "Write 4 short quiz questions based on this board. One per line." },
      { label: "Study plan", prompt: "Turn this board into a 4-step study plan. One step per line." },
      { label: "Draw a diagram", prompt: "educational diagram illustration of the lesson topic", image: true },
    ],
  },
  business: {
    label: "Business",
    icon: Building2,
    hint: "Start from SWOT or a pitch, add ideas as notes, and let Nano shape them.",
    actions: [
      { label: "Summarize", prompt: "Summarize this board into 4 key points. One per line." },
      { label: "Find risks", prompt: "List the 4 biggest risks in this plan. One per line." },
      { label: "Next steps", prompt: "Give 4 concrete next steps for this business. One per line." },
      { label: "Visualize", prompt: "clean modern business concept illustration", image: true },
    ],
  },
  company: {
    label: "Team",
    icon: Users,
    hint: "Run meetings here: agenda template, timer in Present, then action items from Nano.",
    actions: [
      { label: "Meeting summary", prompt: "Summarize this meeting board in 4 short lines." },
      { label: "Action items", prompt: "Extract action items as 'Owner – task – deadline', one per line." },
      { label: "Decisions", prompt: "List the decisions made on this board, one per line." },
      { label: "Visualize", prompt: "minimal team workflow illustration", image: true },
    ],
  },
};

const noteStyle: Record<NoteColor, string> = {
  paper: "bg-glass-strong text-ink ring-glass-border",
  blue: "bg-softblue/12 text-ink ring-softblue/30",
  coral: "bg-accent/12 text-ink ring-accent/30",
  ink: "bg-ink text-paper ring-ink",
};

const penColors: string[] = ["var(--ink)", "var(--softblue)", "var(--accent)", "oklch(0.65 0.17 150)"];

function messageText(message: BoardMessage) {
  return message.parts.map((part) => part.text).join("");
}

function strokeBox(stroke: BoardStroke) {
  const xs = stroke.points.map((p) => p.x);
  const ys = stroke.points.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function AirNanoBoard({ requestedThreadId }: { requestedThreadId?: string }) {
  const navigate = useNavigate();
  const [threads, setThreads] = useState<BoardThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState(requestedThreadId ?? "");
  const [tool, setTool] = useState<Tool>("select");
  const [panel, setPanel] = useState<Panel>("none");
  const [items, setItems] = useState<BoardItem[]>([]);
  const [strokes, setStrokes] = useState<BoardStroke[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [penColor, setPenColor] = useState<string>("var(--ink)");
  const [zoom, setZoom] = useState(100);
  const [prompt, setPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [timer, setTimer] = useState(0);
  const [timerOn, setTimerOn] = useState(false);
  const [laser, setLaser] = useState<{ x: number; y: number } | null>(null);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const loadedId = useRef<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; px: number; py: number; ox: number; oy: number } | null>(null);
  const drawingId = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scale = zoom / 100;
  const [penWidth, setPenWidth] = useState(3);
  const [bg, setBg] = useState("board-dots");
  const [focus, setFocus] = useState(false);
  const [split, setSplit] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [spotlight, setSpotlight] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);
  const history = useRef<{ items: BoardItem[]; strokes: BoardStroke[] }[]>([]);
  const future = useRef<{ items: BoardItem[]; strokes: BoardStroke[] }[]>([]);
  const restoring = useRef(false);
  useEffect(() => {
    if (restoring.current) { restoring.current = false; return; }
    const h = window.setTimeout(() => { history.current = [...history.current.slice(-49), { items, strokes }]; future.current = []; }, 400);
    return () => window.clearTimeout(h);
  }, [items, strokes]);

  useEffect(() => {
    const stored = ensureThreads();
    setThreads(stored);
    const nextId = requestedThreadId && stored.some((t) => t.id === requestedThreadId) ? requestedThreadId : stored[0]?.id;
    if (nextId && nextId !== requestedThreadId) void navigate({ to: "/$threadId", params: { threadId: nextId }, replace: true });
    setActiveThreadId(nextId ?? "");
  }, [navigate, requestedThreadId]);

  const activeThread = useMemo(() => threads.find((t) => t.id === activeThreadId) ?? threads[0], [activeThreadId, threads]);
  const mode: WorkspaceMode = activeThread?.mode ?? "business";
  const meta = modeMeta[mode];

  // Load the canvas contents whenever the board changes.
  useEffect(() => {
    if (!activeThread || loadedId.current === activeThread.id) return;
    loadedId.current = activeThread.id;
    setItems(activeThread.items ?? []);
    setStrokes(activeThread.strokes ?? []);
    setSelectedId(null);
    setSelectedStrokeId(null);
    setEditingId(null);
  }, [activeThread]);

  // Persist canvas contents to the active board.
  useEffect(() => {
    const id = loadedId.current;
    if (!id) return;
    const handle = window.setTimeout(() => {
      const all = readThreads().map((t) => (t.id === id ? { ...t, items, strokes, updatedAt: new Date().toISOString() } : t));
      writeThreads(all);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [items, strokes]);

  useEffect(() => {
    if (!timerOn) return;
    const handle = window.setInterval(() => setTimer((t) => t + 1), 1000);
    return () => window.clearInterval(handle);
  }, [timerOn]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if ((event.metaKey || event.ctrlKey) && event.key === "k") { event.preventDefault(); setPaletteOpen(true); return; }
    if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;
      if (event.key === "Escape") { setPresenting(false); setPanel("none"); setSelectedId(null); setSelectedStrokeId(null); }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedId) { setItems((c) => c.filter((i) => i.id !== selectedId)); setSelectedId(null); }
        if (selectedStrokeId) { setStrokes((c) => c.filter((s) => s.id !== selectedStrokeId)); setSelectedStrokeId(null); }
      }
      if (event.key === "v") setTool("select");
      if (event.key === "t") setTool("text");
      if (event.key === "p") setTool("pen");
      if (event.key === "l") setTool("laser");
      if (event.key === "e") setTool("eraser");
      if ((event.metaKey || event.ctrlKey) && event.key === "k") { event.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, selectedStrokeId]);

  const saveThread = (updated: BoardThread) => {
    setThreads((current) => current.map((t) => (t.id === updated.id ? updated : t)));
    writeThreads(readThreads().map((t) => (t.id === updated.id ? { ...updated, items, strokes } : t)));
  };

  const openThread = (threadId: string) => {
    setActiveThreadId(threadId);
    void navigate({ to: "/$threadId", params: { threadId } });
  };

  const newBoard = (nextMode: WorkspaceMode = mode) => {
    const next = { ...createThread(nextMode), items: [], strokes: [] };
    const nextThreads = [next, ...readThreads()];
    writeThreads(nextThreads);
    setThreads(nextThreads);
    setShowWorkspaceMenu(false);
    openThread(next.id);
  };

  const deleteBoard = (threadId: string) => {
    const rest = readThreads().filter((t) => t.id !== threadId);
    const final = rest.length ? rest : [{ ...createThread(mode), items: [], strokes: [] }];
    writeThreads(final);
    setThreads(final);
    if (threadId === activeThreadId) { loadedId.current = null; openThread(final[0]!.id); }
  };

  const switchWorkspace = (next: WorkspaceMode) => {
    setShowWorkspaceMenu(false);
    if (activeThread) saveThread({ ...activeThread, mode: next });
  };

  const toCanvas = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  };

  const viewCenter = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: ((rect?.width ?? 1000) / 2) / scale, y: ((rect?.height ?? 800) / 2) / scale };
  };

  const addNote = (x: number, y: number, text = "", color: NoteColor = "paper", edit = true) => {
    const note: BoardItem = { id: makeId(), kind: "note", x, y, w: 220, text, color };
    setItems((c) => [...c, note]);
    setSelectedId(note.id);
    if (edit) setEditingId(note.id);
    return note;
  };

  const updateItem = (id: string, patch: Partial<BoardItem>) => setItems((c) => c.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  // Canvas pointer handling
  const onCanvasDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget && tool !== "pen") return;
    const p = toCanvas(event.clientX, event.clientY);
    if (tool === "pen") {
      const id = makeId("stroke");
      drawingId.current = id;
      setStrokes((c) => [...c, { id, color: penColor, width: penWidth, points: [p] }]);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (tool === "text") { addNote(p.x - 20, p.y - 20); setTool("select"); return; }
    setSelectedId(null);
    setSelectedStrokeId(null);
    setEditingId(null);
  };

  const onCanvasMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (tool === "laser" || presenting) setLaser({ x: event.clientX, y: event.clientY });
    if (drawingId.current) {
      const p = toCanvas(event.clientX, event.clientY);
      const id = drawingId.current;
      setStrokes((c) => c.map((s) => (s.id === id ? { ...s, points: [...s.points, p] } : s)));
    }
    const d = drag.current;
    if (d) updateItem(d.id, { x: d.ox + (event.clientX - d.px) / scale, y: d.oy + (event.clientY - d.py) / scale });
  };

  const onCanvasUp = () => { drawingId.current = null; drag.current = null; };

  const startItemDrag = (item: BoardItem, event: ReactPointerEvent<HTMLDivElement>) => {
    if (tool !== "select" || editingId === item.id) return;
    event.stopPropagation();
    setSelectedId(item.id);
    setSelectedStrokeId(null);
    drag.current = { id: item.id, px: event.clientX, py: event.clientY, ox: item.x, oy: item.y };
    canvasRef.current?.setPointerCapture(event.pointerId);
  };

  const insertTemplate = (templateId: string) => {
    const template = templatesByMode[mode].find((t) => t.id === templateId);
    if (!template) return;
    const c = viewCenter();
    const width = template.columns.length * 250;
    setItems((cur) => [...cur, ...templateItems(template, Math.max(40, c.x - width / 2), Math.max(110, c.y - 200), () => makeId())]);
    if (activeThread?.title.startsWith("New ")) saveThread({ ...activeThread, title: template.name });
    setPanel("none");
  };

  const boardContext = () => items.filter((i) => i.kind !== "image" && i.text.trim()).map((i) => (i.kind === "heading" ? `## ${i.text}` : `- ${i.text}`)).join("\n").slice(0, 1800);

  const addLinesAsNotes = (text: string) => {
    const lines = text.split("\n").map((l) => l.replace(/^\s*([-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean);
    const c = viewCenter();
    if (lines.length > 1 && lines.length <= 8) {
      setItems((cur) => [...cur, ...lines.map((line, i) => ({ id: makeId(), kind: "note" as const, x: c.x - 480 + (i % 4) * 240, y: c.y - 120 + Math.floor(i / 4) * 150, w: 220, text: line, color: "blue" as NoteColor }))]);
    } else addNote(c.x - 110, c.y - 60, text, "blue", false);
  };

  const runAI = async (text: string, image = false) => {
    if (!text.trim() || !activeThread || aiBusy) return;
    const userMessage = makeMessage("user", text);
    let thread: BoardThread = { ...activeThread, title: activeThread.title.startsWith("New ") ? text.slice(0, 28) : activeThread.title, messages: [...activeThread.messages, userMessage] };
    saveThread(thread);
    setPrompt("");
    setAiBusy(true);
    let reply: string;
    if (image) {
      const topic = boardContext().split("\n").slice(0, 3).join(", ");
      const src = pollinationsImageUrl(`${text}${topic ? `: ${topic}` : ""}`);
      const c = viewCenter();
      const img: BoardItem = { id: makeId(), kind: "image", x: c.x - 180, y: c.y - 120, w: 360, text, color: "paper", src };
      setItems((cur) => [...cur, img]);
      setSelectedId(img.id);
      reply = "I added an image to the board. Drag it where you need it.";
    } else {
      try {
        const system = `You are Nano, a helpful assistant inside a whiteboard app used for ${meta.label.toLowerCase()} work. Reply in plain text, short lines, no markdown symbols. Current board notes:\n${boardContext() || "(board is empty)"}`;
        reply = await askPollinations(text, system);
      } catch {
        reply = nanoReply(text, null);
      }
    }
    thread = { ...thread, messages: [...thread.messages, makeMessage("assistant", reply)], updatedAt: new Date().toISOString() };
    saveThread(thread);
    setAiBusy(false);
  };

  const exportBoard = () => {
    const lines = [`${activeThread?.title ?? "Board"} — ${meta.label}`, new Date().toLocaleString(), "", boardContext() || "(no notes)", "", "Nano chat:", ...(activeThread?.messages ?? []).map((m) => `${m.role === "user" ? "You" : "Nano"}: ${messageText(m)}`)];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(activeThread?.title ?? "board").replace(/[^\w]+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copyShareLink = async () => {
    await navigator.clipboard?.writeText(window.location.href);
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1800);
  };

  const togglePresent = () => {
    const next = !presenting;
    setPresenting(next);
    setPanel("none");
    if (next) { setTool("laser"); void document.documentElement.requestFullscreen?.().catch(() => undefined); }
    else { setTool("select"); setLaser(null); if (document.fullscreenElement) void document.exitFullscreen(); }
  };

  const selectedStroke = strokes.find((s) => s.id === selectedStrokeId);
  const visibleThreads = threads.filter((t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const isEmpty = items.length === 0 && strokes.length === 0;
  const ModeIcon = meta.icon;

  // ---------- AI agent: acts directly on the board ----------
  const agent = async (kind: "notes" | "mindmap" | "replace" | "groups", instruction: string, label: string) => {
    if (!activeThread || aiBusy) return;
    const target = items.find((i) => i.id === selectedId);
    if (kind === "replace" && !target) { setPanel("ai"); saveThread({ ...activeThread, messages: [...activeThread.messages, makeMessage("assistant", "Select a note first, then run that tool again.")] }); return; }
    setAiBusy(true);
    setPanel("ai");
    let thread: BoardThread = { ...activeThread, messages: [...activeThread.messages, makeMessage("user", label)] };
    saveThread(thread);
    let reply = "";
    try {
      const system = `You are Nano, an AI agent that edits a whiteboard for ${meta.label.toLowerCase()} work. Output plain text only, no markdown, no numbering symbols, no intro sentence.${kind === "notes" ? " Output one item per line, at most 8 lines, each under 18 words." : ""}${kind === "mindmap" ? " First line: the central topic (max 4 words). Then 6 branch ideas, one per line, each under 8 words." : ""}${kind === "groups" ? " Output lines in the form 'Group name: item'. Use 2 to 4 groups." : ""}${kind === "replace" ? " Output only the rewritten text." : ""}\nBoard notes:\n${boardContext() || "(empty)"}`;
      const input = kind === "replace" ? `${instruction}\n\nText: ${target!.text}` : instruction;
      reply = await askPollinations(input, system);
      const lines = reply.split("\n").map((l) => l.replace(/^\s*([-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean);
      const c = viewCenter();
      if (kind === "notes") addLinesAsNotes(lines.slice(0, 8).join("\n"));
      if (kind === "replace") updateItem(target!.id, { text: reply.trim() });
      if (kind === "mindmap") {
        const [center, ...branches] = lines;
        const r = 270;
        setItems((cur) => [...cur,
          { id: makeId(), kind: "shape", shape: "circle", x: c.x - 90, y: c.y - 90, w: 180, text: center ?? "Topic", color: "blue" },
          ...branches.slice(0, 8).map((b, i, arr) => { const a = (i / arr.length) * Math.PI * 2 - Math.PI / 2; return { id: makeId(), kind: "note" as const, x: c.x + Math.cos(a) * r - 100, y: c.y + Math.sin(a) * r * 0.8 - 40, w: 200, text: b, color: "paper" as NoteColor }; }),
        ]);
      }
      if (kind === "groups") {
        const groups = new Map<string, string[]>();
        lines.forEach((l) => { const [g0, ...rest] = l.split(":"); const g = g0 ?? ""; if (rest.length) groups.set(g.trim(), [...(groups.get(g.trim()) ?? []), rest.join(":").trim()]); });
        const cols = Array.from(groups.entries()).slice(0, 4);
        const colors: NoteColor[] = ["blue", "coral", "paper", "ink"];
        setItems((cur) => [...cur, ...cols.flatMap(([g, notes], ci) => [
          { id: makeId(), kind: "heading" as const, x: c.x - cols.length * 125 + ci * 250, y: c.y - 220, w: 230, text: g, color: colors[ci]! },
          ...notes.slice(0, 5).map((n, ni) => ({ id: makeId(), kind: "note" as const, x: c.x - cols.length * 125 + ci * 250, y: c.y - 160 + ni * 110, w: 230, text: n, color: colors[ci]! })),
        ])]);
      }
      reply = kind === "replace" ? `Updated the note:\n${reply}` : `Done — I placed this on the board:\n${reply}`;
    } catch {
      reply = "I couldn't reach the AI service just now. Please try again in a moment.";
    }
    thread = { ...thread, messages: [...thread.messages, makeMessage("assistant", reply)], updatedAt: new Date().toISOString() };
    saveThread(thread);
    setAiBusy(false);
  };

  const react = (emoji: string) => {
    const id = makeId("r");
    setReactions((r) => [...r, { id, emoji, x: 10 + Math.random() * 80 }]);
    window.setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 2700);
  };

  const undo = () => {
    if (history.current.length < 2) return;
    future.current.push(history.current.pop()!);
    const prev = history.current[history.current.length - 1]!;
    restoring.current = true;
    setItems(prev.items);
    setStrokes(prev.strokes);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    history.current.push(next);
    restoring.current = true;
    setItems(next.items);
    setStrokes(next.strokes);
  };

  const addAt = (partial: Omit<BoardItem, "id" | "x" | "y">) => {
    const c = viewCenter();
    const item = { ...partial, id: makeId(), x: c.x - partial.w / 2 + (Math.random() * 80 - 40), y: c.y - 60 + (Math.random() * 80 - 40) } as BoardItem;
    setItems((cur) => [...cur, item]);
    setSelectedId(item.id);
    setTool("select");
  };

  const sel = items.find((i) => i.id === selectedId);
  const download = (name: string, content: string, type: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const commands: PaletteCommand[] = [
    // Create
    { id: "c-note", group: "Create", label: "Sticky note", hint: "T", run: () => addAt({ kind: "note", w: 220, text: "", color: "paper" }) },
    { id: "c-blue", group: "Create", label: "Blue note", run: () => addAt({ kind: "note", w: 220, text: "", color: "blue" }) },
    { id: "c-coral", group: "Create", label: "Coral note", run: () => addAt({ kind: "note", w: 220, text: "", color: "coral" }) },
    { id: "c-dark", group: "Create", label: "Dark note", run: () => addAt({ kind: "note", w: 220, text: "", color: "ink" }) },
    { id: "c-head", group: "Create", label: "Heading", run: () => addAt({ kind: "heading", w: 280, text: "Heading", color: "paper" }) },
    { id: "c-check", group: "Create", label: "Checklist", run: () => addAt({ kind: "note", w: 240, text: "☐ Task one\n☐ Task two\n☐ Task three", color: "paper" }) },
    { id: "c-rect", group: "Create", label: "Rectangle", run: () => addAt({ kind: "shape", shape: "rect", w: 220, text: "", color: "ink" }) },
    { id: "c-circle", group: "Create", label: "Circle", run: () => addAt({ kind: "shape", shape: "circle", w: 160, text: "", color: "blue" }) },
    { id: "c-date", group: "Create", label: "Date stamp", run: () => addAt({ kind: "note", w: 220, text: new Date().toLocaleString(), color: "coral" }) },
    { id: "c-emoji", group: "Create", label: "Star sticker", run: () => addAt({ kind: "heading", w: 80, text: "⭐", color: "paper" }) },
    { id: "c-img", group: "Create", label: "Image from link", run: () => { const src = window.prompt("Image link"); if (src) addAt({ kind: "image", w: 360, text: "Image", color: "paper", src }); } },
    { id: "c-link", group: "Create", label: "Link card", run: () => { const url = window.prompt("Web link"); if (url) addAt({ kind: "note", w: 260, text: `🔗 ${url}`, color: "blue" }); } },
    // Edit
    { id: "e-undo", group: "Edit", label: "Undo", hint: "Ctrl Z", run: undo },
    { id: "e-redo", group: "Edit", label: "Redo", hint: "Ctrl Shift Z", run: redo },
    { id: "e-dup", group: "Edit", label: "Duplicate selected", run: () => sel && setItems((c) => [...c, { ...sel, id: makeId(), x: sel.x + 24, y: sel.y + 24 }]) },
    { id: "e-del", group: "Edit", label: "Delete selected", hint: "Del", run: () => { if (sel) { setItems((c) => c.filter((i) => i.id !== sel.id)); setSelectedId(null); } } },
    { id: "e-front", group: "Edit", label: "Bring to front", run: () => sel && setItems((c) => [...c.filter((i) => i.id !== sel.id), sel]) },
    { id: "e-back", group: "Edit", label: "Send to back", run: () => sel && setItems((c) => [sel, ...c.filter((i) => i.id !== sel.id)]) },
    { id: "e-bigger", group: "Edit", label: "Make selected bigger", run: () => sel && updateItem(sel.id, { w: Math.min(600, sel.w + 40) }) },
    { id: "e-smaller", group: "Edit", label: "Make selected smaller", run: () => sel && updateItem(sel.id, { w: Math.max(80, sel.w - 40) }) },
    { id: "e-snap", group: "Edit", label: "Snap everything to dots", run: () => setItems((c) => c.map((i) => ({ ...i, x: Math.round(i.x / 24) * 24, y: Math.round(i.y / 24) * 24 }))) },
    { id: "e-tidy", group: "Edit", label: "Tidy notes into a grid", run: () => { const c = viewCenter(); setItems((cur) => cur.map((i, n) => ({ ...i, x: c.x - 500 + (n % 4) * 250, y: 120 + Math.floor(n / 4) * 150 }))); } },
    { id: "e-clearink", group: "Edit", label: "Clear all ink", run: () => setStrokes([]) },
    { id: "e-clearnotes", group: "Edit", label: "Clear all notes", run: () => setItems([]) },
    { id: "e-clear", group: "Edit", label: "Clear whole board", run: () => { if (window.confirm("Clear this board?")) { setItems([]); setStrokes([]); } } },
    // Pen
    { id: "p-pen", group: "Pen", label: "Pen", hint: "P", run: () => { setPenWidth(3); setTool("pen"); } },
    { id: "p-thin", group: "Pen", label: "Fine pen", run: () => { setPenWidth(1.5); setTool("pen"); } },
    { id: "p-thick", group: "Pen", label: "Marker", run: () => { setPenWidth(6); setTool("pen"); } },
    { id: "p-high", group: "Pen", label: "Highlighter", run: () => { setPenWidth(16); setPenColor("oklch(0.85 0.17 95)"); setTool("pen"); } },
    { id: "p-eraser", group: "Pen", label: "Eraser", hint: "E", run: () => setTool("eraser") },
    { id: "p-blue", group: "Pen", label: "Blue ink", run: () => { setPenColor("var(--softblue)"); setTool("pen"); } },
    { id: "p-coral", group: "Pen", label: "Coral ink", run: () => { setPenColor("var(--accent)"); setTool("pen"); } },
    { id: "p-white", group: "Pen", label: "Chalk white ink", run: () => { setPenColor("oklch(0.98 0 0)"); setTool("pen"); } },
    // View
    { id: "v-in", group: "View", label: "Zoom in", run: () => setZoom((v) => Math.min(200, v + 10)) },
    { id: "v-out", group: "View", label: "Zoom out", run: () => setZoom((v) => Math.max(50, v - 10)) },
    { id: "v-reset", group: "View", label: "Reset zoom", run: () => setZoom(100) },
    { id: "v-dots", group: "View", label: "Dot background", run: () => setBg("board-dots") },
    { id: "v-grid", group: "View", label: "Grid background", run: () => setBg("board-grid") },
    { id: "v-plain", group: "View", label: "Plain white background", run: () => setBg("board-plain") },
    { id: "v-chalk", group: "View", label: "Chalkboard", run: () => setBg("board-chalk") },
    { id: "v-focus", group: "View", label: focus ? "Show menus" : "Focus mode (hide menus)", run: () => setFocus((f) => !f) },
    { id: "v-full", group: "View", label: "Full screen", run: () => void document.documentElement.requestFullscreen?.().catch(() => undefined) },
    { id: "v-cursor", group: "View", label: "Board tour: show shortcuts", run: () => { setPanel("ai"); saveThread({ ...activeThread!, messages: [...activeThread!.messages, makeMessage("assistant", "Shortcuts:\nV select · T note · P pen · E eraser · L laser\nCtrl/⌘ K all tools · Ctrl Z undo · Del delete\nDouble-click the board to add a note.")] }); } },
    // Present
    { id: "pr-present", group: "Present", label: presenting ? "Exit presentation" : "Start presentation", run: togglePresent },
    { id: "pr-split", group: "Present", label: split ? "Close split screen" : "Split screen: board + live video", run: () => setSplit((s) => !s) },
    { id: "pr-cam", group: "Present", label: cameraOn ? "Hide presenter camera" : "Presenter camera bubble", run: () => setCameraOn((v) => !v) },
    { id: "pr-laser", group: "Present", label: "Laser pointer", hint: "L", run: () => setTool("laser") },
    { id: "pr-spot", group: "Present", label: spotlight ? "Turn off spotlight" : "Spotlight around pointer", run: () => { setSpotlight((s) => !s); setTool("laser"); } },
    { id: "pr-timer", group: "Present", label: timerOn ? "Pause timer" : "Start timer", run: () => setTimerOn((v) => !v) },
    { id: "pr-reset", group: "Present", label: "Reset timer", run: () => { setTimer(0); setTimerOn(false); } },
    { id: "pr-clap", group: "Present", label: "Reaction: applause 👏", run: () => react("👏") },
    { id: "pr-heart", group: "Present", label: "Reaction: love ❤️", run: () => react("❤️") },
    { id: "pr-party", group: "Present", label: "Reaction: celebrate 🎉", run: () => { for (let i = 0; i < 6; i++) window.setTimeout(() => react("🎉"), i * 120); } },
    { id: "pr-idea", group: "Present", label: "Reaction: idea 💡", run: () => react("💡") },
    // File
    { id: "f-new", group: "File", label: "New board", run: () => newBoard() },
    { id: "f-rename", group: "File", label: "Rename board", run: () => { const t = window.prompt("Board name", activeThread?.title); if (t && activeThread) saveThread({ ...activeThread, title: t }); } },
    { id: "f-dupboard", group: "File", label: "Duplicate board", run: () => { const copy = { ...createThread(mode), title: `${activeThread?.title ?? "Board"} copy`, items, strokes }; const all = [copy, ...readThreads()]; writeThreads(all); setThreads(all); openThread(copy.id); } },
    { id: "f-txt", group: "File", label: "Export notes (.txt)", run: exportBoard },
    { id: "f-json", group: "File", label: "Export board file (.json)", run: () => download(`${activeThread?.title ?? "board"}.json`, JSON.stringify({ items, strokes }), "application/json") },
    { id: "f-import", group: "File", label: "Import board file", run: () => { const input = document.createElement("input"); input.type = "file"; input.accept = ".json"; input.onchange = async () => { const f = input.files?.[0]; if (!f) return; try { const data = JSON.parse(await f.text()); setItems(data.items ?? []); setStrokes(data.strokes ?? []); } catch { window.alert("That file isn't a board file."); } }; input.click(); } },
    { id: "f-print", group: "File", label: "Print / save as PDF", run: () => window.print() },
    { id: "f-share", group: "File", label: "Share link", run: () => setShareOpen(true) },
    { id: "f-tpl", group: "File", label: "Templates", run: () => setPanel("templates") },
    // AI agent
    { id: "a-brain", group: "AI agent", ai: true, label: "Brainstorm 8 ideas onto the board", run: () => void agent("notes", "Brainstorm 8 fresh ideas that build on this board.", "Brainstorm ideas") },
    { id: "a-mind", group: "AI agent", ai: true, label: "Build a mind map", run: () => void agent("mindmap", "Create a mind map for the main topic of this board.", "Build a mind map") },
    { id: "a-group", group: "AI agent", ai: true, label: "Sort notes into groups", run: () => void agent("groups", "Group every note on this board into themed groups.", "Sort notes into groups") },
    { id: "a-actions", group: "AI agent", ai: true, label: "Extract action items as notes", run: () => void agent("notes", "List action items as 'Owner – task – deadline'.", "Extract action items") },
    { id: "a-quiz", group: "AI agent", ai: true, label: "Make quiz cards", run: () => void agent("notes", "Write 6 short quiz questions with the answer in brackets.", "Make quiz cards") },
    { id: "a-flash", group: "AI agent", ai: true, label: "Make flashcards", run: () => void agent("notes", "Write 6 flashcards as 'Term — definition'.", "Make flashcards") },
    { id: "a-agenda", group: "AI agent", ai: true, label: "Create meeting agenda", run: () => void agent("notes", "Create a 6-item meeting agenda with minutes per item.", "Create agenda") },
    { id: "a-slides", group: "AI agent", ai: true, label: "Turn board into slide outline", run: () => void agent("notes", "Turn this board into a 6-slide presentation outline, one slide title and key point per line.", "Slide outline") },
    { id: "a-swot", group: "AI agent", ai: true, label: "Run a SWOT analysis", run: () => void agent("groups", "Do a SWOT analysis using groups Strengths, Weaknesses, Opportunities, Threats.", "SWOT analysis") },
    { id: "a-risks", group: "AI agent", ai: true, label: "Find risks and blockers", run: () => void agent("notes", "List the main risks and blockers.", "Find risks") },
    { id: "a-steps", group: "AI agent", ai: true, label: "Plan next steps", run: () => void agent("notes", "Give concrete next steps in order.", "Plan next steps") },
    { id: "a-questions", group: "AI agent", ai: true, label: "Questions to ask the room", run: () => void agent("notes", "Write 5 discussion questions for the audience.", "Discussion questions") },
    { id: "a-examples", group: "AI agent", ai: true, label: "Add real-world examples", run: () => void agent("notes", "Give 5 real-world examples that illustrate this board.", "Real-world examples") },
    { id: "a-fix", group: "AI agent", ai: true, label: "Fix spelling of selected note", run: () => void agent("replace", "Fix spelling and grammar.", "Fix spelling") },
    { id: "a-short", group: "AI agent", ai: true, label: "Shorten selected note", run: () => void agent("replace", "Rewrite this much shorter and clearer.", "Shorten note") },
    { id: "a-expand", group: "AI agent", ai: true, label: "Expand selected note", run: () => void agent("replace", "Expand this into 3 clear sentences.", "Expand note") },
    { id: "a-kid", group: "AI agent", ai: true, label: "Explain selected note like I'm 10", run: () => void agent("replace", "Explain this simply for a 10 year old.", "Explain simply") },
    { id: "a-fr", group: "AI agent", ai: true, label: "Translate selected note to French", run: () => void agent("replace", "Translate to French.", "Translate to French") },
    { id: "a-es", group: "AI agent", ai: true, label: "Translate selected note to Spanish", run: () => void agent("replace", "Translate to Spanish.", "Translate to Spanish") },
    { id: "a-sum", group: "AI agent", ai: true, label: "Summarize board in chat", run: () => { setPanel("ai"); void runAI("Summarize this board in 4 short lines."); } },
    { id: "a-img", group: "AI agent", ai: true, label: "Generate an illustration", run: () => { setPanel("ai"); void runAI("clean illustration of the board topic", true); } },
    { id: "a-diagram", group: "AI agent", ai: true, label: "Generate a diagram image", run: () => { setPanel("ai"); void runAI("simple labeled educational diagram", true); } },
    { id: "a-chat", group: "AI agent", ai: true, label: "Open Nano chat", run: () => setPanel("ai") },
  ];

  const dockTools: { id: Tool; label: string; icon: typeof Type; key: string }[] = [
    { id: "select", label: "Select", icon: MousePointer2, key: "V" },
    { id: "text", label: "Note", icon: Type, key: "T" },
    { id: "pen", label: "Pen", icon: PenLine, key: "P" },
    { id: "eraser", label: "Eraser", icon: Eraser, key: "E" },
    { id: "laser", label: "Laser", icon: Zap, key: "L" },
  ];

  return (
    <div className="relative flex h-screen w-full overflow-hidden">
    <main className={`relative h-full min-w-0 flex-1 overflow-hidden ${bg} font-display text-ink select-none`}>
      {!presenting && (
        <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-ink text-sm font-extrabold text-paper">A</div>
            <div className="relative min-w-0">
              <button type="button" onClick={() => setShowWorkspaceMenu((v) => !v)} className="flex min-w-0 items-center gap-1 text-left leading-none">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-extrabold tracking-tight">{activeThread?.title ?? "Untitled"}</span>
                  <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-cool"><ModeIcon className="size-3" />{meta.label} board</span>
                </span>
                <ChevronDown className="size-4 shrink-0 text-cool" />
              </button>
              {showWorkspaceMenu && (
                <div className="air-pop absolute left-0 top-11 w-56 rounded-2xl glass-surface p-2 shadow-glass ring-1 ring-glass-border">
                  <p className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cool">This board is for</p>
                  {(Object.keys(modeMeta) as WorkspaceMode[]).map((m) => {
                    const Icon = modeMeta[m].icon;
                    return <Button key={m} variant="ghost" onClick={() => switchWorkspace(m)} className="w-full justify-start rounded-xl"><Icon className="text-softblue" />{modeMeta[m].label}{mode === m && <Check className="ml-auto" />}</Button>;
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button variant="glass" size="sm" onClick={() => newBoard()} className="rounded-full px-3" aria-label="New board"><FilePlus2 /><span className="hidden sm:inline">New</span></Button>
            <Button variant="glass" size="sm" onClick={exportBoard} className="hidden rounded-full px-3 sm:inline-flex" aria-label="Export board"><Download /><span className="hidden md:inline">Export</span></Button>
            <Button variant="glass" size="sm" onClick={() => setShareOpen(true)} className="hidden rounded-full px-3 sm:inline-flex">Share</Button>
            <Button size="sm" onClick={togglePresent} className="rounded-full bg-softblue px-3 text-paper hover:bg-softblue/90"><Presentation /><span className="hidden sm:inline">Present</span></Button>
          </div>
        </header>
      )}

      {!presenting && (
        <aside className="absolute left-4 top-24 z-20 hidden w-56 flex-col gap-2 rounded-[24px] glass-surface p-3 shadow-glass ring-1 ring-glass-border lg:flex">
          <div className="flex items-center gap-2 rounded-xl bg-paper/70 px-2 ring-1 ring-glass-border">
            <Search className="size-3.5 text-cool" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search boards" className="h-8 w-full bg-transparent text-xs outline-none" />
          </div>
          <div className="max-h-[50vh] space-y-0.5 overflow-y-auto">
            {visibleThreads.map((t) => {
              const Icon = modeMeta[t.mode ?? "business"].icon;
              return (
                <div key={t.id} className="group flex items-center">
                  <Button variant="ghost" onClick={() => openThread(t.id)} className={`min-w-0 flex-1 justify-start rounded-xl px-2.5 text-xs ${t.id === activeThread?.id ? "bg-softblue/10 text-softblue" : "text-cool"}`}>
                    <Icon className="size-3.5 shrink-0" /><span className="truncate">{t.title}</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteBoard(t.id)} aria-label={`Delete ${t.title}`} className="size-7 rounded-full text-cool opacity-0 group-hover:opacity-100"><Trash2 className="size-3.5" /></Button>
                </div>
              );
            })}
          </div>
          <Button variant="ghost" onClick={() => newBoard()} className="justify-start rounded-xl px-2.5 text-xs text-cool"><Plus /> New board</Button>
        </aside>
      )}

      {/* Canvas */}
      <div
        ref={canvasRef}
        className={`absolute inset-0 z-10 touch-none ${tool === "pen" ? "cursor-crosshair" : tool === "text" ? "cursor-text" : tool === "laser" ? "cursor-none" : ""}`}
        onPointerDown={onCanvasDown}
        onPointerMove={onCanvasMove}
        onPointerUp={onCanvasUp}
        onPointerCancel={onCanvasUp}
        onPointerLeave={() => setLaser(null)}
        onDoubleClick={(e) => { if (e.target === e.currentTarget && tool === "select") { const p = toCanvas(e.clientX, e.clientY); addNote(p.x - 20, p.y - 20); } }}
      >
        <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${scale})`, width: `${100 / scale}%`, height: `${100 / scale}%` }}>
          <svg className="absolute inset-0 size-full overflow-visible">
            {strokes.map((s) => (
              <g key={s.id}>
                <polyline points={s.points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={s.color} strokeWidth={s.width} strokeOpacity={s.width >= 12 ? 0.35 : 1} strokeLinecap="round" strokeLinejoin="round" />
                {(tool === "select" || tool === "eraser") && (
                  <polyline
                    points={s.points.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none" stroke="transparent" strokeWidth={Math.max(18, s.width + 8)}
                    className="pointer-events-auto cursor-pointer"
                    style={{ pointerEvents: "stroke" }}
                    onPointerDown={(e) => { e.stopPropagation(); if (tool === "eraser") { setStrokes((c) => c.filter((x) => x.id !== s.id)); return; } setSelectedStrokeId(s.id); setSelectedId(null); }}
                    onPointerEnter={(e) => { if (tool === "eraser" && e.buttons) setStrokes((c) => c.filter((x) => x.id !== s.id)); }}
                  />
                )}
              </g>
            ))}
            {selectedStroke && (() => { const b = strokeBox(selectedStroke); return <rect x={b.x - 10} y={b.y - 10} width={b.x2 - b.x + 20} height={b.y2 - b.y + 20} rx={12} fill="none" stroke="var(--softblue)" strokeDasharray="6 5" strokeWidth={1.5} />; })()}
          </svg>

          {items.map((item) => {
            const selected = selectedId === item.id;
            if (item.kind === "shape") {
              const border = item.color === "blue" ? "border-softblue" : item.color === "coral" ? "border-accent" : "border-ink";
              return (
                <div key={item.id} onPointerDown={(e) => startItemDrag(item, e)} onDoubleClick={(e) => { e.stopPropagation(); setEditingId(item.id); }} className={`air-pop pointer-events-auto absolute grid place-items-center border-[3px] ${border} ${item.shape === "circle" ? "rounded-full" : "rounded-2xl"} ${selected ? "outline-2 outline-offset-4 outline-softblue" : ""}`} style={{ left: item.x, top: item.y, width: item.w, height: item.shape === "circle" ? item.w : item.w * 0.6, outlineStyle: selected ? "solid" : undefined }}>
                  {editingId === item.id ? <input autoFocus value={item.text} onChange={(e) => updateItem(item.id, { text: e.target.value })} onBlur={() => setEditingId(null)} onPointerDown={(e) => e.stopPropagation()} className="w-3/4 bg-transparent text-center text-sm font-bold outline-none" /> : <span className="px-2 text-center text-sm font-bold">{item.text}</span>}
                </div>
              );
            }
            if (item.kind === "image") {
              return (
                <div key={item.id} onPointerDown={(e) => startItemDrag(item, e)} className={`air-pop pointer-events-auto absolute overflow-hidden rounded-3xl bg-glass-strong shadow-soft ring-1 ${selected ? "ring-2 ring-softblue" : "ring-glass-border"} ${tool === "select" ? "cursor-grab active:cursor-grabbing" : ""}`} style={{ left: item.x, top: item.y, width: item.w }}>
                  <img src={item.src} alt={item.text} draggable={false} className="aspect-[3/2] w-full bg-muted object-cover" />
                  <p className="truncate px-3 py-2 text-[11px] font-medium text-cool">{item.text}</p>
                </div>
              );
            }
            const heading = item.kind === "heading";
            return (
              <div
                key={item.id}
                onPointerDown={(e) => startItemDrag(item, e)}
                onDoubleClick={(e) => { e.stopPropagation(); setEditingId(item.id); }}
                className={`air-pop pointer-events-auto absolute ${heading ? "px-1" : `rounded-2xl p-3.5 shadow-soft ring-1 ${noteStyle[item.color]}`} ${selected ? "outline-2 outline-offset-2 outline-softblue" : ""} ${tool === "select" && editingId !== item.id ? "cursor-grab active:cursor-grabbing" : ""}`}
                style={{ left: item.x, top: item.y, width: item.w, outlineStyle: selected ? "solid" : undefined }}
              >
                {editingId === item.id ? (
                  <textarea
                    autoFocus
                    value={item.text}
                    onChange={(e) => updateItem(item.id, { text: e.target.value })}
                    onBlur={() => setEditingId(null)}
                    onPointerDown={(e) => e.stopPropagation()}
                    placeholder="Type…"
                    rows={heading ? 1 : 3}
                    className={`w-full resize-none bg-transparent outline-none ${heading ? "text-lg font-extrabold" : "text-sm leading-snug"}`}
                  />
                ) : (
                  <p className={`whitespace-pre-wrap break-words ${heading ? "text-lg font-extrabold tracking-tight" : "min-h-10 text-sm leading-snug"} ${!item.text ? "opacity-40" : ""}`}>{item.text || "Double-click to write"}</p>
                )}
              </div>
            );
          })}
        </div>

        {isEmpty && !presenting && (
          <div className="air-rise pointer-events-none absolute inset-0 grid place-items-center px-6">
            <div className="max-w-md text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-softblue">{meta.label} board</p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">A clean canvas.</h1>
              <p className="mt-3 text-sm text-cool">{meta.hint}</p>
              <div className="pointer-events-auto mt-6 flex flex-wrap justify-center gap-2">
                {templatesByMode[mode].map((t) => <Button key={t.id} variant="glass" size="sm" onClick={() => insertTemplate(t.id)} className="rounded-full"><LayoutTemplate />{t.name}</Button>)}
              </div>
              <p className="mt-4 text-[11px] text-cool">or double-click anywhere to add a note</p>
            </div>
          </div>
        )}
      </div>

      {/* Laser pointer */}
      {laser && (tool === "laser") && (
        <div className="pointer-events-none fixed z-50 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive shadow-[0_0_18px_6px_var(--destructive)]" style={{ left: laser.x, top: laser.y }} />
      )}

      {/* Contextual popovers */}
      {selectedStroke && tool === "select" && (() => {
        const b = strokeBox(selectedStroke);
        const rect = canvasRef.current?.getBoundingClientRect();
        return (
          <div className="air-pop absolute z-30 flex items-center gap-1 rounded-2xl glass-surface p-1.5 shadow-glass ring-1 ring-glass-border" style={{ left: (rect?.left ?? 0) + b.x * scale, top: Math.max(70, (rect?.top ?? 0) + b.y * scale - 56) }}>
            {penColors.map((c) => <button key={c} type="button" aria-label="Recolor ink" onClick={() => setStrokes((cur) => cur.map((s) => (s.id === selectedStroke.id ? { ...s, color: c } : s)))} className="size-6 rounded-full ring-2 ring-paper" style={{ background: c }} />)}
            <Button variant="ghost" size="sm" className="h-7 rounded-xl px-2 text-xs" onClick={() => { addNote(b.x2 + 16, b.y, "", "blue"); setSelectedStrokeId(null); }}><Type />Label</Button>
            <Button variant="ghost" size="icon" className="size-7 rounded-xl" aria-label="Delete ink" onClick={() => { setStrokes((cur) => cur.filter((s) => s.id !== selectedStroke.id)); setSelectedStrokeId(null); }}><Trash2 /></Button>
          </div>
        );
      })()}

      {selectedId && tool === "select" && !editingId && (() => {
        const item = items.find((i) => i.id === selectedId);
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!item) return null;
        return (
          <div className="air-pop absolute z-30 flex items-center gap-1 rounded-2xl glass-surface p-1.5 shadow-glass ring-1 ring-glass-border" style={{ left: (rect?.left ?? 0) + item.x * scale, top: Math.max(70, (rect?.top ?? 0) + item.y * scale - 52) }}>
            {item.kind !== "image" && (["paper", "blue", "coral", "ink"] as NoteColor[]).map((c) => <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => updateItem(item.id, { color: c })} className={`size-6 rounded-full ring-2 ${item.color === c ? "ring-softblue" : "ring-paper"} ${c === "paper" ? "bg-paper" : c === "blue" ? "bg-softblue" : c === "coral" ? "bg-accent" : "bg-ink"}`} />)}
            {item.kind !== "image" && <Button variant="ghost" size="sm" className="h-7 rounded-xl px-2 text-xs text-softblue" onClick={() => { setPanel("ai"); void runAI(`Expand on this idea: "${item.text}"`); }}><WandSparkles />Ask Nano</Button>}
            <Button variant="ghost" size="icon" className="size-7 rounded-xl" aria-label="Duplicate" onClick={() => setItems((c) => [...c, { ...item, id: makeId(), x: item.x + 24, y: item.y + 24 }])}><Copy /></Button>
            <Button variant="ghost" size="icon" className="size-7 rounded-xl" aria-label="Delete" onClick={() => { setItems((c) => c.filter((i) => i.id !== item.id)); setSelectedId(null); }}><Trash2 /></Button>
          </div>
        );
      })()}

      {/* Present-mode bar */}
      {presenting && (
        <div className="air-pop absolute left-1/2 top-4 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full glass-surface p-1.5 shadow-glass ring-1 ring-glass-border">
          <span className="px-3 font-mono text-sm font-bold tabular-nums">{formatTime(timer)}</span>
          <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => setTimerOn((v) => !v)} aria-label={timerOn ? "Pause timer" : "Start timer"}>{timerOn ? <Pause /> : <Play />}</Button>
          <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => { setTimer(0); setTimerOn(false); }} aria-label="Reset timer"><RotateCcw /></Button>
          <div className="mx-1 h-5 w-px bg-ink/10" />
          <Button variant="ghost" size="sm" className="rounded-full" onClick={togglePresent}><X />Exit</Button>
        </div>
      )}

      {/* Templates panel */}
      {panel === "templates" && (
        <div className="air-pop absolute bottom-24 left-1/2 z-40 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 rounded-[28px] glass-surface p-4 shadow-glass ring-1 ring-glass-border">
          <div className="mb-3 flex items-center justify-between"><p className="text-sm font-bold">{meta.label} templates</p><Button variant="ghost" size="icon" className="size-7 rounded-full" onClick={() => setPanel("none")} aria-label="Close templates"><X /></Button></div>
          <div className="grid gap-2">
            {templatesByMode[mode].map((t) => (
              <button key={t.id} type="button" onClick={() => insertTemplate(t.id)} className="flex items-center gap-3 rounded-2xl bg-paper/70 p-3 text-left ring-1 ring-glass-border transition hover:-translate-y-0.5 hover:ring-softblue/40">
                <span className="grid size-9 place-items-center rounded-xl bg-softblue/12 text-softblue"><LayoutTemplate className="size-4" /></span>
                <span><span className="block text-sm font-bold">{t.name}</span><span className="block text-xs text-cool">{t.description}</span></span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI panel */}
      {panel === "ai" && (
        <aside className="air-pop absolute bottom-24 right-4 top-20 z-40 flex w-[min(23rem,calc(100vw-2rem))] flex-col rounded-[28px] glass-surface p-4 shadow-glass ring-1 ring-glass-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-softblue text-paper"><Sparkles className="size-4" /></span><div><p className="text-sm font-bold">Nano</p><p className="text-[11px] text-cool">Reads your board notes</p></div></div>
            <Button variant="ghost" size="icon" onClick={() => setPanel("none")} aria-label="Close Nano" className="size-8 rounded-full"><X /></Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {meta.actions.map((a) => <Button key={a.label} variant="glass" size="sm" disabled={aiBusy} onClick={() => void runAI(a.prompt, a.image)} className="h-7 rounded-full px-2.5 text-[11px]">{a.image ? <ImagePlus /> : <WandSparkles />}{a.label}</Button>)}
          </div>
          <div className="mt-3 flex-1 space-y-2.5 overflow-y-auto pr-1">
            {(activeThread?.messages ?? []).map((m) => (
              <div key={m.id} className={`max-w-[90%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "ml-auto bg-ink text-paper" : "bg-paper/80 ring-1 ring-glass-border"}`}>
                <p className="whitespace-pre-wrap select-text">{messageText(m)}</p>
                {m.role === "assistant" && m !== activeThread?.messages[0] && (
                  <button type="button" onClick={() => addLinesAsNotes(messageText(m))} className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-softblue"><Plus className="size-3" />Add to board</button>
                )}
              </div>
            ))}
            {aiBusy && <div className="flex items-center gap-2 text-xs text-cool"><Loader2 className="size-3.5 animate-spin" />Nano is thinking…</div>}
          </div>
          <div className="mt-3 rounded-2xl bg-paper/75 p-2 ring-1 ring-glass-border">
            <Textarea ref={textareaRef} value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void runAI(prompt); } }} placeholder="Ask Nano anything about this board…" className="min-h-14 resize-none border-0 bg-transparent px-2 py-1 text-sm shadow-none focus-visible:ring-0" />
            <div className="flex items-center justify-between px-1 pt-1">
              <button type="button" disabled={!prompt.trim() || aiBusy} onClick={() => void runAI(prompt, true)} className="flex items-center gap-1 text-[11px] font-semibold text-cool hover:text-softblue disabled:opacity-40"><ImagePlus className="size-3.5" />Make image</button>
              <Button size="icon" disabled={aiBusy} onClick={() => void runAI(prompt)} aria-label="Send" className="size-8 rounded-xl bg-softblue hover:bg-softblue/90"><ArrowUp /></Button>
            </div>
          </div>
        </aside>
      )}

      {/* Share */}
      {shareOpen && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-ink/15 px-4 backdrop-blur-sm" onClick={() => setShareOpen(false)}>
          <section className="air-pop w-full max-w-md rounded-[28px] glass-surface p-6 shadow-glass ring-1 ring-glass-border" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between"><div><p className="text-lg font-extrabold">Share this board</p><p className="mt-1 text-sm text-cool">Boards are saved on this device. Use Present on a projector or screen share, and Export to send notes afterwards.</p></div><Button variant="ghost" size="icon" onClick={() => setShareOpen(false)} aria-label="Close sharing" className="rounded-full"><X /></Button></div>
            <div className="mt-5 flex gap-2">
              <Button variant="ink" className="flex-1 rounded-2xl" onClick={copyShareLink}>{shareCopied ? <Check /> : <Copy />}{shareCopied ? "Copied" : "Copy link"}</Button>
              <Button variant="glass" className="flex-1 rounded-2xl" onClick={exportBoard}><Download />Export notes</Button>
            </div>
          </section>
        </div>
      )}

      {/* Zoom */}
      {!presenting && (
        <div className="absolute bottom-6 left-4 z-20 hidden items-center gap-1 rounded-full glass-surface p-1 shadow-glass ring-1 ring-glass-border sm:flex">
          <Button variant="ghost" size="icon" className="size-8 rounded-full" aria-label="Zoom out" onClick={() => setZoom((v) => Math.max(50, v - 10))}><ZoomOut /></Button>
          <button type="button" onClick={() => setZoom(100)} className="min-w-11 text-center text-[11px] font-semibold text-cool">{zoom}%</button>
          <Button variant="ghost" size="icon" className="size-8 rounded-full" aria-label="Zoom in" onClick={() => setZoom((v) => Math.min(200, v + 10))}><ZoomIn /></Button>
        </div>
      )}

      {/* Pen options */}
      {tool === "pen" && (
        <div className="air-pop absolute bottom-24 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full glass-surface p-1.5 shadow-glass ring-1 ring-glass-border">
          {penColors.map((c) => <button key={c} type="button" aria-label="Pen color" onClick={() => setPenColor(c)} className={`size-7 rounded-full ring-2 transition-transform ${penColor === c ? "scale-110 ring-softblue" : "ring-paper"}`} style={{ background: c }} />)}
          <div className="h-5 w-px bg-ink/10" />
          <Button variant="ghost" size="icon" className="size-8 rounded-full" disabled={!strokes.length} onClick={() => setStrokes((c) => c.slice(0, -1))} aria-label="Undo stroke"><Undo2 /></Button>
          <Button variant="ghost" size="icon" className="size-8 rounded-full" disabled={!strokes.length} onClick={() => setStrokes([])} aria-label="Clear ink"><Trash2 /></Button>
        </div>
      )}

      {/* Dock */}
      <nav className="air-rise absolute bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-full glass-surface p-1.5 shadow-glass ring-1 ring-glass-border">
        {dockTools.map(({ id, label, icon: Icon, key }) => {
          const active = tool === id;
          return (
            <button key={id} type="button" onClick={() => setTool(id)} aria-label={label} title={`${label} (${key})`} className={`group relative grid size-11 place-items-center rounded-full transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-1 active:scale-90 ${active ? "bg-ink text-paper shadow-soft" : "text-cool hover:bg-paper hover:text-ink"}`}>
              <Icon className="size-[18px]" />
              <span className="pointer-events-none absolute -top-8 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[10px] font-semibold text-paper opacity-0 transition-opacity group-hover:opacity-100">{label}</span>
            </button>
          );
        })}
        <div className="mx-1 h-6 w-px bg-ink/10" />
        <button type="button" onClick={() => setPanel(panel === "templates" ? "none" : "templates")} aria-label="Templates" className={`group relative grid size-11 place-items-center rounded-full transition-all duration-200 hover:-translate-y-1 active:scale-90 ${panel === "templates" ? "bg-softblue/15 text-softblue" : "text-cool hover:bg-paper hover:text-ink"}`}>
          <LayoutTemplate className="size-[18px]" />
          <span className="pointer-events-none absolute -top-8 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[10px] font-semibold text-paper opacity-0 transition-opacity group-hover:opacity-100">Templates</span>
        </button>
        <button type="button" onClick={() => { setPanel(panel === "ai" ? "none" : "ai"); window.requestAnimationFrame(() => textareaRef.current?.focus()); }} aria-label="Ask Nano" className={`ml-0.5 flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-all duration-200 hover:-translate-y-1 active:scale-95 ${panel === "ai" ? "bg-softblue text-paper shadow-soft" : "bg-softblue/12 text-softblue"}`}>
          <Sparkles className="size-4" /><span className="hidden sm:inline">Nano</span>
        </button>
        <button type="button" onClick={() => setPaletteOpen(true)} aria-label="All tools" title="All tools (Ctrl/⌘ K)" className="ml-0.5 flex h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-paper transition-all duration-200 hover:-translate-y-1 active:scale-95">
          <Command className="size-4" /><span className="hidden sm:inline">{commands.length} tools</span>
        </button>
      </nav>

      {spotlight && laser && (
        <div className="pointer-events-none fixed inset-0 z-[45]" style={{ background: `radial-gradient(circle 170px at ${laser.x}px ${laser.y}px, transparent 0, transparent 160px, oklch(0.18 0.014 270 / 72%) 172px)` }} />
      )}
    </main>
      {split && <div className="h-full w-[min(50%,40rem)] shrink-0"><MediaPane onClose={() => setSplit(false)} /></div>}
      {cameraOn && <CameraBubble onClose={() => setCameraOn(false)} />}
      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}
      <Reactions items={reactions} />
      <AirCursor tool={tool} />
    </div>
  );
}
