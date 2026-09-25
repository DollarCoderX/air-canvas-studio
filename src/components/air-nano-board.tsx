import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Edit3,
  FilePlus2,
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
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  BoardMessage,
  BoardThread,
  createThread,
  ensureThreads,
  makeMessage,
  nanoReply,
  readThreads,
  writeThreads,
} from "@/lib/board-storage";

type Tool = "pen" | "chat" | "edit" | "settings";

const cards = [
  {
    id: "capture",
    label: "Capture",
    title: "Voice notes become sticky notes",
    body: "Tap the mic, talk, and Nano drops a card where you point.",
    tone: "accent",
    position: "left-[46%] top-32",
  },
  {
    id: "chat",
    label: "AI Chat",
    title: "Ask Nano to summarize a cluster",
    body: "Select a group and get a one-line thesis in seconds.",
    tone: "blue",
    position: "left-[62%] top-56",
  },
  {
    id: "transform",
    label: "Transform",
    title: "Transform selection",
    body: "Resize, rotate, and reflow blocks with a single drag.",
    tone: "ink",
    position: "left-24 top-[46%]",
  },
];

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const stored = ensureThreads();
    setThreads(stored);
    const nextId = requestedThreadId && stored.some((thread) => thread.id === requestedThreadId)
      ? requestedThreadId
      : stored[0]?.id;
    if (nextId && nextId !== requestedThreadId) void navigate({ to: "/$threadId", params: { threadId: nextId }, replace: true });
    setActiveThreadId(nextId ?? "");
  }, [navigate, requestedThreadId]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? threads[0],
    [activeThreadId, threads],
  );

  const openThread = (threadId: string) => {
    setActiveThreadId(threadId);
    void navigate({ to: "/$threadId", params: { threadId } });
  };

  const newBoard = () => {
    const next = createThread();
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
      title: activeThread.title === "Untitled ideas" ? text.slice(0, 28) : activeThread.title,
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

  return (
    <main className="relative h-screen w-full overflow-hidden board-grid font-display text-ink select-none">
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-ink text-sm font-extrabold tracking-tight text-paper">A</div>
          <div className="min-w-0 leading-none">
            <p className="truncate text-[15px] font-extrabold tracking-tight">Air Nano Board</p>
            <p className="mt-1 truncate text-[11px] font-medium text-cool">{activeThread?.title ?? "Untitled ideas"}</p>
          </div>
          <ChevronDown className="hidden size-4 text-cool sm:block" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="glass" size="sm" onClick={newBoard} className="rounded-full px-3 sm:px-4">
            <span className="size-1.5 rounded-full bg-accent" />
            <span className="hidden sm:inline">New board</span>
            <FilePlus2 className="sm:hidden" />
          </Button>
          <Button variant="glass" size="sm" className="rounded-full px-3 sm:px-4">Share</Button>
        </div>
      </header>

      <aside className="absolute left-4 top-24 z-20 hidden w-52 flex-col gap-2 rounded-[24px] glass-surface p-3 shadow-glass ring-1 ring-glass-border lg:flex">
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="text-xs font-bold">Boards</span>
          <Button variant="ghost" size="icon" aria-label="Search boards" className="size-7 rounded-full"><Search /></Button>
        </div>
        <div className="space-y-1">
          {threads.map((thread) => (
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
        <section className="air-rise absolute left-6 top-28 max-w-[26ch] sm:left-16">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-softblue">Idea · 01</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">Sketch the whole product in one breath</h1>
          <p className="mt-3 max-w-[34ch] text-sm text-cool">Drag, type, and ask Nano to reshape any block. Everything stays on the sheet.</p>
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
        <Button variant="glass" size="icon" onClick={() => setIsDrawing((value) => !value)} aria-label="Toggle drawing mode" className={isDrawing ? "text-softblue" : ""}><Hand /></Button>
        <Button variant="glass" size="icon" onClick={newBoard} aria-label="Create new board"><Plus /></Button>
      </div>
    </main>
  );
}