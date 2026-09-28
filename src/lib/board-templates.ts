import type { BoardItem, NoteColor, WorkspaceMode } from "@/lib/board-storage";

export type BoardTemplate = { id: string; name: string; description: string; columns: { title: string; color: NoteColor; notes: string[] }[] };

export const templatesByMode: Record<WorkspaceMode, BoardTemplate[]> = {
  school: [
    { id: "lesson", name: "Lesson plan", description: "Goal, explain, practice, check", columns: [
      { title: "Learning goal", color: "blue", notes: ["By the end, students can…"] },
      { title: "Explain", color: "paper", notes: ["Key idea 1", "Key idea 2"] },
      { title: "Practice", color: "coral", notes: ["Pair activity (10 min)"] },
      { title: "Check", color: "ink", notes: ["Exit question"] },
    ] },
    { id: "kwl", name: "KWL chart", description: "Know, Want to know, Learned", columns: [
      { title: "What we Know", color: "blue", notes: [""] },
      { title: "What we Want to know", color: "coral", notes: [""] },
      { title: "What we Learned", color: "paper", notes: [""] },
    ] },
    { id: "quiz", name: "Quick quiz", description: "Questions to answer live", columns: [
      { title: "Question 1", color: "blue", notes: ["A) …  B) …  C) …"] },
      { title: "Question 2", color: "coral", notes: ["A) …  B) …  C) …"] },
      { title: "Question 3", color: "paper", notes: ["A) …  B) …  C) …"] },
    ] },
  ],
  business: [
    { id: "swot", name: "SWOT", description: "Strengths, weaknesses, opportunities, threats", columns: [
      { title: "Strengths", color: "blue", notes: [""] },
      { title: "Weaknesses", color: "coral", notes: [""] },
      { title: "Opportunities", color: "paper", notes: [""] },
      { title: "Threats", color: "ink", notes: [""] },
    ] },
    { id: "journey", name: "Customer journey", description: "From discovery to loyalty", columns: [
      { title: "Discover", color: "blue", notes: [""] },
      { title: "Consider", color: "paper", notes: [""] },
      { title: "Buy", color: "coral", notes: [""] },
      { title: "Return", color: "ink", notes: [""] },
    ] },
    { id: "pitch", name: "Pitch outline", description: "Problem to ask", columns: [
      { title: "Problem", color: "coral", notes: [""] },
      { title: "Solution", color: "blue", notes: [""] },
      { title: "Market", color: "paper", notes: [""] },
      { title: "The ask", color: "ink", notes: [""] },
    ] },
  ],
  company: [
    { id: "meeting", name: "Meeting agenda", description: "Agenda, notes, decisions, actions", columns: [
      { title: "Agenda", color: "blue", notes: ["1. ", "2. "] },
      { title: "Notes", color: "paper", notes: [""] },
      { title: "Decisions", color: "coral", notes: [""] },
      { title: "Action items", color: "ink", notes: ["Owner · task · date"] },
    ] },
    { id: "retro", name: "Team retro", description: "Went well, improve, try next", columns: [
      { title: "Went well", color: "blue", notes: [""] },
      { title: "To improve", color: "coral", notes: [""] },
      { title: "Try next", color: "paper", notes: [""] },
    ] },
    { id: "roadmap", name: "Project roadmap", description: "Now, next, later", columns: [
      { title: "Now", color: "coral", notes: [""] },
      { title: "Next", color: "blue", notes: [""] },
      { title: "Later", color: "paper", notes: [""] },
    ] },
  ],
};

export function templateItems(template: BoardTemplate, originX: number, originY: number, makeId: () => string): BoardItem[] {
  const items: BoardItem[] = [];
  template.columns.forEach((column, c) => {
    const x = originX + c * 250;
    items.push({ id: makeId(), kind: "heading", x, y: originY, w: 230, text: column.title, color: column.color });
    column.notes.forEach((note, n) => {
      items.push({ id: makeId(), kind: "note", x, y: originY + 56 + n * 130, w: 230, text: note, color: column.color });
    });
  });
  return items;
}
