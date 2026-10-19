import type { BoardEntry } from "../../lib/learningApi.ts";

/** Answered something (or started) this recently: shown with a live dot. */
export const ACTIVE_MS = 2 * 60_000;
/** An unfinished attempt touched this recently counts as "taking it now". */
export const TAKING_NOW_MS = 10 * 60_000;

const time = (iso: string | null) => (iso ? new Date(iso).getTime() || 0 : 0);

export function isActiveRecently(entry: Pick<BoardEntry, "lastActivityAt">, now = Date.now(), within = ACTIVE_MS): boolean {
  const at = time(entry.lastActivityAt);
  return at > 0 && now - at < within;
}

export function isTakingNow(entry: Pick<BoardEntry, "completedAt" | "lastActivityAt">, now = Date.now()): boolean {
  return !entry.completedAt && isActiveRecently(entry, now, TAKING_NOW_MS);
}

/**
 * What a row says about someone's score. The server has already applied
 * privacy, so a null score means "not yours to see" (or an unfinished exam).
 */
export type EntryStatus =
  | { kind: "finished"; score: number; correct: number | null; total: number }
  | { kind: "finished-hidden" }
  | { kind: "exam" }
  | { kind: "starting" }
  | { kind: "hidden" }
  | { kind: "progress"; score: number; correct: number | null; answered: number };

export function entryStatus(entry: BoardEntry): EntryStatus {
  if (entry.completedAt) {
    return entry.score === null ? { kind: "finished-hidden" } : { kind: "finished", score: entry.score, correct: entry.correct, total: entry.total };
  }
  if (entry.mode === "exam") return { kind: "exam" };
  if (entry.answered === 0) return { kind: "starting" };
  if (entry.score === null) return { kind: "hidden" };
  return { kind: "progress", score: entry.score, correct: entry.correct, answered: entry.answered };
}

/** One short line for a row: "Finished · 90%", "4/5 correct", "Score hidden"… */
export function statusLabel(status: EntryStatus): string {
  switch (status.kind) {
    case "finished":
      return `Finished · ${status.score}%`;
    case "finished-hidden":
      return "Finished · score hidden";
    case "exam":
      return "Exam in progress";
    case "starting":
      return "Just started";
    case "hidden":
      return "Score hidden";
    case "progress":
      return status.correct === null ? `${status.score}% so far` : `${status.correct}/${status.answered} correct`;
  }
}

/** In progress first (most recently active on top), then finished (most recent first). Doesn't mutate. */
export function sortBoard(entries: BoardEntry[]): BoardEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const doneA = a.entry.completedAt ? 1 : 0;
      const doneB = b.entry.completedAt ? 1 : 0;
      if (doneA !== doneB) return doneA - doneB;
      const when = (e: BoardEntry) => (e.completedAt ? time(e.completedAt) : time(e.lastActivityAt));
      return when(b.entry) - when(a.entry) || a.index - b.index;
    })
    .map(({ entry }) => entry);
}

export interface RankedEntry {
  entry: BoardEntry;
  /** 1-based, ties share a rank (1, 1, 3); null when there's no visible finished score. */
  rank: number | null;
}

/**
 * "Where everyone landed": finished attempts with a visible score, highest
 * first (ties: who finished first), then everyone else unranked in board order.
 */
export function rankBoard(entries: BoardEntry[]): RankedEntry[] {
  const scored = entries
    .filter(e => e.completedAt && e.score !== null)
    .sort((a, b) => b.score! - a.score! || time(a.completedAt) - time(b.completedAt));
  const ranked: RankedEntry[] = [];
  scored.forEach((entry, i) => {
    const previous = ranked[i - 1];
    ranked.push({ entry, rank: previous && previous.entry.score === entry.score ? previous.rank : i + 1 });
  });
  const rest = sortBoard(entries.filter(e => !scored.includes(e))).map(entry => ({ entry, rank: null }));
  return [...ranked, ...rest];
}

/** Counts for the compact strip: how many are mid-quiz, and whether anyone but me is here. */
export function boardSummary(entries: BoardEntry[], now = Date.now()) {
  return {
    studying: entries.filter(e => !e.completedAt).length,
    activeNow: entries.filter(e => !e.completedAt && isActiveRecently(e, now)).length,
    others: entries.filter(e => !e.isMe).length,
  };
}

export const SHARE_PREFERENCE_KEY = "quizzes.shareScore";

/** The remembered "Share my score" choice. Default on: anything but a stored false means share. */
export function parseSharePreference(raw: string | null | undefined): boolean {
  return raw !== "false";
}
