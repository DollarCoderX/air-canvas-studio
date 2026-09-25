export type BoardRole = "user" | "assistant";

export type BoardMessage = {
  id: string;
  role: BoardRole;
  parts: [{ type: "text"; text: string }];
  createdAt: string;
};

export type BoardThread = {
  id: string;
  title: string;
  updatedAt: string;
  messages: BoardMessage[];
};

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

export function createThread(): BoardThread {
  const now = new Date().toISOString();
  return {
    id: makeThreadId(),
    title: "Untitled ideas",
    updatedAt: now,
    messages: [
      makeMessage(
        "assistant",
        "I’m Nano. Select a card, sketch an idea, or ask me to reshape the board.",
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
  const initial = [createThread()];
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
  if (selectedLabel) {
    return `I can transform “${selectedLabel}” into a tighter brief, a task list, or a visual cluster. Which direction should I take?`;
  }
  return "Try asking me to summarize the board, group the ideas, or turn a selection into a next-step plan.";
}