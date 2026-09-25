import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowUp,
  Building2,
  Check,
  ChevronDown,
  Copy,
  Edit3,
  FilePlus2,
  GraduationCap,
  Hand,
  LayoutGrid,
  MessageCircle,
  MoreHorizontal,
  Move,
  PenLine,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Undo2,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  BoardMessage,
  BoardThread,
  WorkspaceMode,
  createThread,
  ensureThreads,
  makeMessage,
  nanoReply,
  readThreads,
  writeThreads,
} from "@/lib/board-storage";

type Tool = "pen" | "chat" | "edit" | "settings";
type CanvasCard = { id: string; label: string; title: string; body: string; tone: string; position: string };

const workspaceCards: Record<WorkspaceMode, CanvasCard[]> = {
  school: [
    { id: "capture", label: "Lesson", title: "Photosynthesis, made visual", body: "Build a concept map from class notes and source material.", tone: "accent", position: "left-[46%] top-32" },
    { id: "chat", label: "Study with AI", title: "Create a five-question quiz", body: "Nano adapts questions to the material already on the board.", tone: "blue", position: "left-[62%] top-56" },
    { id: "transform", label: "Assignment", title: "Turn research into an outline", body: "Group evidence, claims, and sources before drafting.", tone: "ink", position: "left-24 top-[46%]" },
  ],
  business: [
    { id: "capture", label: "Customer", title: "Voice notes become insights", body: "Capture interviews and group recurring customer needs.", tone: "accent", position: "left-[46%] top-32" },
    { id: "chat", label: "AI Strategy", title: "Summarize the opportunity", body: "Turn the selected cluster into a one-page business brief.", tone: "blue", position: "left-[62%] top-56" },
    { id: "transform", label: "Plan", title: "Shape the next experiment", body: "Convert assumptions into owners, actions, and deadlines.", tone: "ink", position: "left-24 top-[46%]" },
  ],
  company: [
    { id: "capture", label: "Meeting", title: "Decisions stay with the work", body: "Capture decisions, owners, and open questions in one place.", tone: "accent", position: "left-[46%] top-32" },
    { id: "chat", label: "Team AI", title: "Brief every stakeholder", body: "Nano creates summaries for leadership, product, or delivery teams.", tone: "blue", position: "left-[62%] top-56" },
    { id: "transform", label: "Project", title: "Move from plan to action", body: "Reframe the board as milestones, risks, and responsibilities.", tone: "ink", position: "left-24 top-[46%]" },
  ],
};

const workspaceCopy: Record<WorkspaceMode, { label: string; title: string; body: string }> = {
  school: { label: "Classroom · 01", title: "Learn together on one living canvas", body: "Teach, research, quiz, and turn every idea into something students can see." },
  business: { label: "Business · 01", title: "Turn customer insight into your next move", body: "Explore ideas, test assumptions, and ask Nano to shape a practical plan." },
  company: { label: "Company · 01", title: "Keep every team aligned around the work", body: "Plan projects, capture decisions, and leave every meeting with clear owners." },
};

const toolItems: { id: Tool; label: string; hint: string }[] = [
  { id: "pen", label: "Pen", hint: "Draw on the board" },
  { id: "chat", label: "AI Chat", hint: "Ask Nano" },
  { id: "edit", label: "Edit", hint: "Transform selection" },
  { id: "settings", label: "Settings", hint: "Board preferences" },
];

function IconForTool({ tool }: { tool: Tool }) {
  if (tool === "pen") return <PenLine />;
  if (tool === "chat") return <Sparkles />;
  if (tool === "edit") return <Edit3 />;
  return <Settings2 />;
}

function replaceThread(updated: BoardThread) {
  const threads = readThreads();
  writeThreads(threads.map((thread) => (thread.id === updated.id ? updated : thread)));
}

function messageText(message: BoardMessage) {
  return message.parts.map((part) => part.text).join("");
}

export function AirNanoBoard({ requestedThreadId }: { requestedThreadId?: string }) {
  const navigate = useNavigate();
  const [threads, setThreads] = useState<BoardThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState(requestedThreadId ?? "");
  const [activeTool, setActiveTool] = useState<Tool>("edit");
  const [selectedCard, setSelectedCard] = useState("Onboarding flow v3");
  const [prompt, setPrompt] = useState("");
  const [zoom, setZoom] = useState(100);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedCards, setSelectedCards] = useState<string[]>(["onboarding"]);
  const [dragOffsets, setDragOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingCard, setDraggingCard] = useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("business");
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [strokes, setStrokes] = useState<{ id: string; points: { x: number; y: number }[] }[]>([]);
  const [activeStrokeId, setActiveStrokeId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const stored = ensureThreads();
    setThreads(stored);
    const nextId = requestedThreadId && stored.some((thread) => thread.id === requestedThreadId)
      ? requestedThreadId
      : stored[0]?.id;
    if (nextId && nextId !== requestedThreadId) void navigate({ to: "/$threadId", params: { threadId: nextId }, replace: true });
    setActiveThreadId(nextId ?? "");
    const nextThread = stored.find((thread) => thread.id === nextId);
    if (nextThread?.mode) setWorkspaceMode(nextThread.mode);
  }, [navigate, requestedThreadId]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? threads[0],
    [activeThreadId, threads],
  );

  const openThread = (threadId: string) => {
    const thread = threads.find((item) => item.id === threadId);
    if (thread?.mode) setWorkspaceMode(thread.mode);
    setActiveThreadId(threadId);
    void navigate({ to: "/$threadId", params: { threadId } });
  };

  const newBoard = () => {
    const next = createThread(workspaceMode);
    const nextThreads = [next, ...threads];
    setThreads(nextThreads);
    writeThreads(nextThreads);
    openThread(next.id);
  };

  const updateThreads = (updated: BoardThread) => {
    setThreads((current) => current.map((thread) => (thread.id === updated.id ? updated : thread)));
    replaceThread(updated);
  };

  const sendPrompt = () => {
    const text = prompt.trim();
    if (!text || !activeThread) return;
    const userMessage = makeMessage("user", text);
    const assistantMessage = makeMessage("assistant", nanoReply(text, selectedCard));
    const updated: BoardThread = {
      ...activeThread,
      title: activeThread.title.startsWith("New ") ? text.slice(0, 28) : activeThread.title,
      updatedAt: new Date().toISOString(),
      messages: [...activeThread.messages, userMessage, assistantMessage],
    };
    updateThreads(updated);
    setPrompt("");
    setActiveTool("chat");
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const selectTool = (tool: Tool) => {
    setActiveTool(tool);
    if (tool === "chat") window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const startDragging = (cardId: string, event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingCard(cardId);
    setSelectedCards([cardId]);
  };

  const moveCard = (cardId: string, event: PointerEvent<HTMLButtonElement>) => {
    if (draggingCard !== cardId) return;
    setDragOffsets((current) => ({
      ...current,
      [cardId]: {
        x: (current[cardId]?.x ?? 0) + event.movementX,
        y: (current[cardId]?.y ?? 0) + event.movementY,
      },
    }));
  };

  const currentMessages = activeThread?.messages ?? [];
  const cards = workspaceCards[workspaceMode];
  const intro = workspaceCopy[workspaceMode];
  const visibleThreads = threads.filter((thread) => thread.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const switchWorkspace = (mode: WorkspaceMode) => {
    setWorkspaceMode(mode);
    setShowWorkspaceMenu(false);
  };

  const copyShareLink = async () => {
    await navigator.clipboard?.writeText(window.location.href);
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1800);
  };

  const beginStroke = (event: PointerEvent<SVGSVGElement>) => {
    if (activeTool !== "pen") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const id = `stroke-${Date.now()}`;
    setStrokes((current) => [...current, { id, points: [{ x: event.clientX - bounds.left, y: event.clientY - bounds.top }] }]);
    setActiveStrokeId(id);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const continueStroke = (event: PointerEvent<SVGSVGElement>) => {
    if (!activeStrokeId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    setStrokes((current) => current.map((stroke) => stroke.id === activeStrokeId ? { ...stroke, points: [...stroke.points, point] } : stroke));
  };

  return (
    <main className="relative h-screen w-full overflow-hidden board-grid font-display text-ink select-none">
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-ink text-sm font-extrabold tracking-tight text-paper">A</div>
          <div className="min-w-0 leading-none">
            <p className="truncate text-[15px] font-extrabold tracking-tight">Air Nano Board</p>
            <p className="mt-1 truncate text-[11px] font-medium text-cool">{activeThread?.title ?? "Untitled ideas"}</p>
          </div>
          <div className="relative hidden sm:block">
            <Button variant="ghost" size="icon" onClick={() => setShowWorkspaceMenu((value) => !value)} aria-label="Switch workspace" className="size-8 rounded-full"><ChevronDown /></Button>
            {showWorkspaceMenu && <div className="absolute left-0 top-10 w-48 rounded-2xl glass-surface p-2 shadow-glass ring-1 ring-glass-border">
              {(["school", "business", "company"] as WorkspaceMode[]).map((mode) => <Button key={mode} variant="ghost" onClick={() => switchWorkspace(mode)} className="w-full justify-start rounded-xl capitalize"><span className="text-softblue">{mode === "school" ? <GraduationCap /> : mode === "business" ? <Building2 /> : <Users />}</span>{mode}{workspaceMode === mode && <Check className="ml-auto" />}</Button>)}
            </div>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="glass" size="sm" onClick={newBoard} className="rounded-full px-3 sm:px-4">
            <span className="size-1.5 rounded-full bg-accent" />
            <span className="hidden sm:inline">New board</span>
            <FilePlus2 className="sm:hidden" />
          </Button>
          <Button variant="glass" size="sm" onClick={() => setShareOpen(true)} className="rounded-full px-3 sm:px-4">Share</Button>
        </div>
      </header>

      <aside className="absolute left-4 top-24 z-20 hidden w-52 flex-col gap-2 rounded-[24px] glass-surface p-3 shadow-glass ring-1 ring-glass-border lg:flex">
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="text-xs font-bold">Boards</span>
           <Button variant="ghost" size="icon" onClick={() => setShowSearch((value) => !value)} aria-label="Search boards" className="size-7 rounded-full"><Search /></Button>
        </div>
         {showSearch && <input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search boards" className="h-9 w-full rounded-xl bg-paper/75 px-3 text-xs outline-none ring-1 ring-glass-border focus:ring-softblue" />}
        <div className="space-y-1">
           {visibleThreads.map((thread) => (
            <div key={thread.id} className="group flex items-center gap-1">
              <Button
                variant="ghost"
                onClick={() => openThread(thread.id)}
                className={`min-w-0 flex-1 justify-start rounded-xl px-3 text-left text-xs ${thread.id === activeThreadId ? "bg-dock-active/10 text-softblue" : "text-cool"}`}
              >
                <LayoutGrid className="size-3.5 shrink-0" />
                <span className="truncate">{thread.title}</span>
              </Button>
              {thread.id === activeThreadId && <Check className="mr-2 size-3.5 text-softblue" />}
            </div>
          ))}
        </div>
        <Button variant="ghost" onClick={newBoard} className="justify-start rounded-xl px-3 text-xs text-cool">
          <Plus /> New board
        </Button>
      </aside>

      <div className="absolute inset-0 z-10 overflow-hidden">
        <svg aria-label="Drawing layer" className={`absolute inset-0 z-10 size-full ${activeTool === "pen" ? "cursor-crosshair" : "pointer-events-none"}`} onPointerDown={beginStroke} onPointerMove={continueStroke} onPointerUp={() => setActiveStrokeId(null)} onPointerCancel={() => setActiveStrokeId(null)}>
          {strokes.map((stroke) => <polyline key={stroke.id} points={stroke.points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-ink" />)}
        </svg>
        <section className="air-rise absolute left-6 top-28 max-w-[26ch] sm:left-16">
           <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-softblue">{intro.label}</p>
           <h1 className="mt-3 text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">{intro.title}</h1>
           <p className="mt-3 max-w-[34ch] text-sm text-cool">{intro.body}</p>
        </section>

        {cards.map((card, index) => (
          <button
            key={card.id}
            type="button"
            onClick={() => { if (!draggingCard) { setSelectedCard(card.title); setSelectedCards([card.id]); setActiveTool("edit"); } }}
            onPointerDown={(event) => startDragging(card.id, event)}
            onPointerMove={(event) => moveCard(card.id, event)}
            onPointerUp={() => setDraggingCard(null)}
            className={`air-rise glass-card absolute ${card.position} w-60 rounded-3xl p-5 text-left shadow-soft ring-1 ring-glass-border transition-transform duration-300 hover:-translate-y-1 sm:w-64 ${selectedCard === card.title ? "ring-2 ring-softblue" : ""}`}
            style={{ animationDelay: `${index * 80}ms`, translate: `${dragOffsets[card.id]?.x ?? 0}px ${dragOffsets[card.id]?.y ?? 0}px` }}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-[0.18em] ${card.tone === "accent" ? "text-accent" : card.tone === "blue" ? "text-softblue" : "text-ink"}`}>{card.label}</span>
              <span className={`size-2 rounded-full ${card.tone === "accent" ? "bg-accent" : card.tone === "blue" ? "bg-softblue" : "bg-ink"}`} />
            </div>
            <p className="mt-3 text-lg font-bold leading-tight">{card.title}</p>
            <p className="mt-2 text-sm text-cool">{card.body}</p>
          </button>
        ))}

        <button
          type="button"
          onClick={() => { setSelectedCard("Onboarding flow v3"); setSelectedCards(["onboarding"]); setActiveTool("edit"); }}
          className={`absolute left-[40%] top-[52%] w-56 rounded-3xl bg-softblue/10 p-5 text-left transition-shadow ${selectedCard === "Onboarding flow v3" ? "ring-2 ring-softblue" : "ring-1 ring-softblue/30"}`}
          aria-label="Select onboarding flow card"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-softblue">Selected</p>
          <p className="mt-2 text-lg font-bold leading-tight">Onboarding flow v3</p>
          {selectedCard === "Onboarding flow v3" && <><span className="absolute -left-1.5 -top-1.5 size-3 rounded-full bg-softblue ring-2 ring-paper" /><span className="absolute -right-1.5 -top-1.5 size-3 rounded-full bg-softblue ring-2 ring-paper" /><span className="absolute -bottom-1.5 -left-1.5 size-3 rounded-full bg-softblue ring-2 ring-paper" /><span className="absolute -bottom-1.5 -right-1.5 size-3 rounded-full bg-softblue ring-2 ring-paper" /></>}
        </button>

        <div className="air-float absolute left-[70%] top-24 rounded-2xl glass-surface px-4 py-3 shadow-glass ring-1 ring-glass-border">
          <p className="text-[11px] font-semibold text-cool">Ask Nano</p>
          <p className="text-sm font-bold">“Make this calmer”</p>
        </div>
        <div className="air-float-slow absolute left-[58%] top-[64%] rounded-2xl glass-surface px-4 py-3 shadow-glass ring-1 ring-glass-border">
          <p className="text-[11px] font-semibold text-cool">Nano suggests</p>
          <p className="text-sm font-bold">Group into 3 themes</p>
        </div>
        <div className="air-float absolute left-[30%] top-[70%] rounded-2xl glass-surface px-4 py-3 shadow-glass ring-1 ring-glass-border">
          <p className="text-[11px] font-semibold text-cool">Pen</p>
          <p className="text-sm font-bold">Ink · 2px · warm</p>
        </div>
      </div>

      {activeTool === "edit" && (
        <div className="absolute left-6 top-[62%] z-20 flex items-center gap-2 rounded-2xl glass-surface px-3 py-2 shadow-glass ring-1 ring-glass-border">
          <span className="text-[11px] font-semibold text-cool">{selectedCards.length === 4 ? "4 objects selected" : "1 object selected"}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedCards(selectedCards.length === 4 ? [] : ["capture", "chat", "transform", "onboarding"])}
            className="h-7 rounded-xl px-2 text-[11px] text-softblue"
          >
            {selectedCards.length === 4 ? "Clear" : "Select all"}
          </Button>
        </div>
      )}

      {activeTool === "pen" && strokes.length > 0 && <Button variant="glass" size="sm" onClick={() => setStrokes((current) => current.slice(0, -1))} className="absolute left-6 top-[62%] z-20 rounded-full"><Undo2 /> Undo stroke</Button>}

      {activeTool === "settings" && (
        <aside className="absolute right-6 top-20 z-30 w-[min(18rem,calc(100vw-3rem))] rounded-[28px] glass-surface p-5 shadow-glass ring-1 ring-glass-border">
          <div className="flex items-center justify-between"><p className="text-sm font-bold">Settings</p><Button variant="ghost" size="icon" onClick={() => setActiveTool("edit")} aria-label="Close settings" className="size-7 rounded-full"><X /></Button></div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between"><span className="font-medium text-cool">Grid</span><span className="flex items-center gap-1 text-xs font-semibold">Dots <span className="grid size-5 place-items-center rounded-md bg-softblue/15 text-softblue"><Check className="size-3" /></span></span></div>
            <div className="flex items-center justify-between"><span className="font-medium text-cool">Accent</span><span className="flex gap-1.5"><span className="size-4 rounded-full bg-accent ring-2 ring-accent/30" /><span className="size-4 rounded-full bg-softblue" /><span className="size-4 rounded-full bg-ink" /></span></div>
            <div className="flex items-center justify-between"><span className="font-medium text-cool">AI assist</span><span className="relative inline-block h-5 w-9 rounded-full bg-softblue"><span className="absolute right-0.5 top-0.5 size-4 rounded-full bg-paper" /></span></div>
          </div>
          <Button variant="ink" className="mt-5 w-full rounded-2xl" onClick={() => setActiveTool("edit")}>Apply to board</Button>
        </aside>
      )}

      {activeTool === "chat" && (
        <aside className="absolute bottom-24 right-6 top-20 z-30 flex w-[min(22rem,calc(100vw-3rem))] flex-col rounded-[28px] glass-surface p-4 shadow-glass ring-1 ring-glass-border sm:p-5">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-softblue text-paper"><Sparkles className="size-4" /></span><div><p className="text-sm font-bold">Nano Chat</p><p className="text-[11px] text-cool">Thread · {activeThread?.title ?? "Untitled ideas"}</p></div></div><Button variant="ghost" size="icon" onClick={() => setActiveTool("edit")} aria-label="Close AI chat" className="size-8 rounded-full"><X /></Button></div>
          <div className="mt-5 flex-1 space-y-3 overflow-y-auto pr-1">
            {currentMessages.map((message) => (
              <div key={message.id} className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed ${message.role === "user" ? "ml-auto bg-ink text-paper" : "bg-paper/80 text-ink ring-1 ring-glass-border"}`}>
                {messageText(message)}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl bg-paper/75 p-2 ring-1 ring-glass-border">
            <Textarea ref={textareaRef} value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendPrompt(); } }} placeholder="Ask Nano to…" className="min-h-16 resize-none border-0 bg-transparent px-2 py-1 text-sm shadow-none focus-visible:ring-0" />
            <div className="flex items-center justify-between px-1 pt-1"><span className="text-[10px] text-cool">Enter to send</span><Button variant="default" size="icon" onClick={sendPrompt} aria-label="Send message" className="size-8 rounded-xl bg-softblue hover:bg-softblue/90"><ArrowUp /></Button></div>
          </div>
        </aside>
      )}

      {shareOpen && <div className="absolute inset-0 z-50 grid place-items-center bg-ink/15 px-4 backdrop-blur-sm" onClick={() => setShareOpen(false)}>
        <section className="w-full max-w-md rounded-[28px] glass-surface p-6 shadow-glass ring-1 ring-glass-border" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between"><div><p className="text-lg font-extrabold">Share this board</p><p className="mt-1 text-sm text-cool">Invite classmates or teammates into the same workspace.</p></div><Button variant="ghost" size="icon" onClick={() => setShareOpen(false)} aria-label="Close sharing" className="rounded-full"><X /></Button></div>
          <div className="mt-5 flex rounded-2xl bg-paper/80 p-2 ring-1 ring-glass-border"><input readOnly value={typeof window === "undefined" ? "" : window.location.href} aria-label="Board link" className="min-w-0 flex-1 bg-transparent px-2 text-xs text-cool outline-none" /><Button variant="ink" size="sm" onClick={copyShareLink} className="rounded-xl">{shareCopied ? <Check /> : <Copy />}{shareCopied ? "Copied" : "Copy link"}</Button></div>
          <div className="mt-4 flex items-center gap-2 text-xs text-cool"><span className="flex -space-x-2"><span className="grid size-7 place-items-center rounded-full bg-softblue text-paper ring-2 ring-paper">EP</span><span className="grid size-7 place-items-center rounded-full bg-accent text-paper ring-2 ring-paper">+2</span></span> Anyone with the link can collaborate</div>
        </section>
      </div>}

      <div className="absolute bottom-6 left-4 z-20 hidden items-center gap-1 rounded-xl glass-surface p-1 shadow-glass ring-1 ring-glass-border sm:flex">
        <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(50, value - 10))}><ZoomOut /></Button>
        <span className="min-w-12 text-center text-[11px] font-semibold text-cool">{zoom}%</span>
        <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(200, value + 10))}><ZoomIn /></Button>
      </div>

      <div className="absolute bottom-7 right-6 z-20 hidden items-center gap-2 text-[11px] font-medium text-cool xl:flex"><Move className="size-3.5" /> Drag to move · Double-tap to type · ⌘K to Ask Nano</div>

      <nav className="absolute bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-[32px] glass-surface px-2 py-2 shadow-glass ring-1 ring-glass-border sm:bottom-6 sm:px-3 sm:py-3">
        {toolItems.map((tool) => (
          <Button key={tool.id} variant={activeTool === tool.id ? "default" : "dock"} onClick={() => selectTool(tool.id)} aria-label={tool.label} className={`group flex size-12 flex-col gap-1 rounded-2xl px-2 py-1.5 text-[10px] font-semibold sm:size-14 ${activeTool === tool.id ? "bg-softblue text-paper shadow-soft hover:bg-softblue/90" : ""}`}>
            <IconForTool tool={tool.id} />
            <span className="hidden sm:inline">{tool.label}</span>
          </Button>
        ))}
        <div className="mx-1 hidden h-8 w-px bg-ink/10 sm:block" />
        <div className="hidden min-w-28 flex-col pr-2 leading-tight sm:flex"><span className="text-[11px] font-bold">{toolItems.find((tool) => tool.id === activeTool)?.label}</span><span className="text-[10px] font-medium text-cool">{toolItems.find((tool) => tool.id === activeTool)?.hint}</span></div>
      </nav>

      <div className="absolute bottom-5 right-4 z-30 flex gap-1 lg:hidden">
        <Button variant="glass" size="icon" onClick={() => { setIsDrawing((value) => !value); selectTool("pen"); }} aria-label="Toggle drawing mode" className={isDrawing ? "text-softblue" : ""}><Hand /></Button>
        <Button variant="glass" size="icon" onClick={newBoard} aria-label="Create new board"><Plus /></Button>
      </div>
    </main>
  );
}