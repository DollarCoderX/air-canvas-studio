export type BoardRole = "user" | "assistant";
export type WorkspaceMode = "school" | "business" | "company";

export type BoardMessage = {
  id: string;
  role: BoardRole;
  parts: [{ type: "text"; text: string }];
  createdAt: string;
};

export type NoteColor = "paper" | "blue" | "coral" | "ink";

export type BoardItem = {
  id: string;
  kind: "note" | "heading" | "image" | "shape";
  shape?: "rect" | "circle";
  x: number;
  y: number;
  w: number;
  text: string;
  color: NoteColor;
  src?: string;
};

export type BoardStroke = { id: string; color: string; width: number; points: { x: number; y: number }[] };

export type BoardThread = {
  id: string;
  title: string;
  updatedAt: string;
  messages: BoardMessage[];
  mode?: WorkspaceMode;
  items?: BoardItem[];
  strokes?: BoardStroke[];
};

export function makeId(prefix = "item") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const THREADS_KEY = "air-nano-board.threads";

export function makeThreadId() {
  return `board-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeMessage(role: BoardRole, text: string): BoardMessage {
  return {
    id: `message-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    parts: [{ type: "text", text }],
    createdAt: new Date().toISOString(),
  };
}

const welcomeByMode: Record<WorkspaceMode, string> = {
  school: "Class workspace ready. I can explain a topic, turn notes into a study plan, or build a lesson outline.",
  business: "Business workspace ready. I can sharpen the offer, organize customer insights, or create an action plan.",
  company: "Team workspace ready. I can summarize decisions, map a project, or turn this board into clear owners and next steps.",
};

const titleByMode: Record<WorkspaceMode, string> = {
  school: "New class board",
  business: "New business board",
  company: "New team board",
};

export function createThread(mode: WorkspaceMode = "business"): BoardThread {
  const now = new Date().toISOString();
  return {
    id: makeThreadId(),
    title: titleByMode[mode],
    updatedAt: now,
    mode,
    messages: [
      makeMessage(
        "assistant",
        welcomeByMode[mode],
      ),
    ],
  };
}

export function readThreads(): BoardThread[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(THREADS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as BoardThread[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeThreads(threads: BoardThread[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
}

export function ensureThreads() {
  const current = readThreads();
  if (current.length > 0) return current;
  const initial = [createThread("business")];
  writeThreads(initial);
  return initial;
}

export function findThread(threadId: string) {
  return readThreads().find((thread) => thread.id === threadId);
}

export function nanoReply(prompt: string, selectedLabel: string | null) {
  const normalized = prompt.toLowerCase();
  if (normalized.includes("summar")) {
    return "I see three themes: make the canvas tactile, keep the tools close, and let Nano turn loose thoughts into clear next steps.";
  }
  if (normalized.includes("calm") || normalized.includes("simpl")) {
    return "Try one primary action per card, more breathing room between clusters, and a single accent color for decisions.";
  }
  if (normalized.includes("lesson") || normalized.includes("study") || normalized.includes("quiz")) {
    return "I’ve organized this into a learning goal, three key ideas, a quick practice task, and a check-for-understanding question.";
  }
  if (normalized.includes("meeting") || normalized.includes("action") || normalized.includes("owner")) {
    return "Here’s the decision view: one agreed outcome, three actions with owners, and the next review milestone.";
  }
  if (normalized.includes("customer") || normalized.includes("sales") || normalized.includes("market")) {
    return "I grouped the opportunity into customer need, strongest proof, likely objection, and the next experiment to run.";
  }
  if (selectedLabel) {
    return `I can transform “${selectedLabel}” into a tighter brief, a task list, or a visual cluster. Which direction should I take?`;
  }
  return "Try asking me to summarize the board, group the ideas, or turn a selection into a next-step plan.";
}