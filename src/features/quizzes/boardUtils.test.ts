import { describe, expect, it } from "vitest";
import type { BoardEntry } from "../../lib/learningApi.ts";
import { boardSummary, entryStatus, isActiveRecently, isTakingNow, parseSharePreference, rankBoard, sortBoard, statusLabel } from "./boardUtils.ts";

const NOW = Date.parse("2026-10-19T12:00:00Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

const entry = (over: Partial<BoardEntry> = {}): BoardEntry => ({
  userId: "u",
  name: "Ada",
  avatarUrl: null,
  isMe: false,
  attemptId: "a",
  mode: "practice",
  startedAt: ago(10),
  completedAt: null,
  lastActivityAt: ago(1),
  answered: 5,
  total: 10,
  correct: 4,
  score: 80,
  shareScore: true,
  bestScore: null,
  ...over,
});

describe("activity", () => {
  it("is live within two minutes", () => {
    expect(isActiveRecently(entry({ lastActivityAt: ago(1) }), NOW)).toBe(true);
    expect(isActiveRecently(entry({ lastActivityAt: ago(3) }), NOW)).toBe(false);
    expect(isActiveRecently(entry({ lastActivityAt: "not a date" }), NOW)).toBe(false);
  });
  it("counts unfinished, recently touched attempts as taking it now", () => {
    expect(isTakingNow(entry({ lastActivityAt: ago(8) }), NOW)).toBe(true);
    expect(isTakingNow(entry({ lastActivityAt: ago(30) }), NOW)).toBe(false);
    expect(isTakingNow(entry({ completedAt: ago(0) }), NOW)).toBe(false);
  });
});

describe("entryStatus", () => {
  it("shows a finished score, or that it's hidden", () => {
    const done = entryStatus(entry({ completedAt: ago(0), score: 90, correct: 9 }));
    expect(done).toEqual({ kind: "finished", score: 90, correct: 9, total: 10 });
    expect(statusLabel(done)).toBe("Finished · 90%");
    expect(statusLabel(entryStatus(entry({ completedAt: ago(0), score: null, correct: null })))).toBe("Finished · score hidden");
  });
  it("never shows an unfinished exam's score", () => {
    expect(statusLabel(entryStatus(entry({ mode: "exam", score: null, correct: null })))).toBe("Exam in progress");
  });
  it("handles practice in progress, hidden and just started", () => {
    expect(statusLabel(entryStatus(entry()))).toBe("4/5 correct");
    expect(statusLabel(entryStatus(entry({ score: null, correct: null })))).toBe("Score hidden");
    expect(statusLabel(entryStatus(entry({ answered: 0, score: null, correct: null })))).toBe("Just started");
    expect(statusLabel(entryStatus(entry({ correct: null, score: 60 })))).toBe("60% so far");
  });
});

describe("sorting and ranking", () => {
  const board = [
    entry({ userId: "done-old", attemptId: "1", completedAt: ago(20), score: 70 }),
    entry({ userId: "going-old", attemptId: "2", lastActivityAt: ago(5) }),
    entry({ userId: "done-new", attemptId: "3", completedAt: ago(1), score: 90 }),
    entry({ userId: "going-new", attemptId: "4", lastActivityAt: ago(0) }),
  ];

  it("puts people in progress first, most recent on top", () => {
    expect(sortBoard(board).map(e => e.userId)).toEqual(["going-new", "going-old", "done-new", "done-old"]);
    expect(board[0].userId).toBe("done-old"); // not mutated
  });

  it("ranks visible finished scores, ties share a rank, the rest go unranked", () => {
    const ranked = rankBoard([
      ...board,
      entry({ userId: "tie", attemptId: "5", completedAt: ago(10), score: 90 }),
      entry({ userId: "hidden", attemptId: "6", completedAt: ago(2), score: null, correct: null }),
    ]);
    expect(ranked.map(r => [r.entry.userId, r.rank])).toEqual([
      ["tie", 1], // finished before done-new
      ["done-new", 1],
      ["done-old", 3],
      ["going-new", null],
      ["going-old", null],
      ["hidden", null],
    ]);
  });

  it("summarises the board", () => {
    expect(boardSummary([entry({ isMe: true }), ...board], NOW)).toEqual({ studying: 3, activeNow: 2, others: 4 });
    expect(boardSummary([entry({ isMe: true })], NOW).others).toBe(0);
  });
});

describe("share preference", () => {
  it("defaults to sharing", () => {
    expect(parseSharePreference(null)).toBe(true);
    expect(parseSharePreference("true")).toBe(true);
    expect(parseSharePreference("garbage")).toBe(true);
    expect(parseSharePreference("false")).toBe(false);
  });
});
