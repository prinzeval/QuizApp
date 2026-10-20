import { describe, expect, it } from "vitest";
import type { CardState, Flashcard } from "../../lib/flashcardsApi.ts";
import {
  LEARN_AHEAD_MS,
  canDeleteDeck,
  canEditCards,
  cardMatches,
  dueSummary,
  dueText,
  formatDuration,
  frontFontSize,
  intervalToMs,
  keyToRating,
  needsTopUp,
  nextIndex,
  pageOfLocation,
  sessionCounts,
  sessionProgress,
  sessionReducer,
  startSession,
  streakText,
  todayHeadline,
  upcomingCard,
  validateCard,
  type SessionState,
} from "./flashcardUtils.ts";

const NOW = Date.parse("2026-10-20T12:00:00Z");
const MIN = 60_000;

const state = (status: CardState["status"], due: string | null = null): CardState => ({ status, due, reps: 0, lapses: 0, lastReview: null });
const card = (id: string, status: CardState["status"] = "review"): Flashcard => ({
  id,
  deckId: "d1",
  front: `Front ${id}`,
  back: `Back ${id}`,
  hint: null,
  source: null,
  figureId: null,
  figure: null,
  createdAt: "2026-10-01T00:00:00Z",
  state: state(status, status === "new" ? null : "2026-10-19T00:00:00Z"),
});

const ids = (s: SessionState) => [s.current?.card.id ?? null, ...s.queue.map(entry => entry.card.id)];

describe("intervalToMs", () => {
  it("reads the server's labels", () => {
    expect(intervalToMs("<1m")).toBe(30_000);
    expect(intervalToMs("10m")).toBe(10 * MIN);
    expect(intervalToMs("1h")).toBe(60 * MIN);
    expect(intervalToMs("1d")).toBe(24 * 60 * MIN);
    expect(intervalToMs("4d")).toBe(4 * 24 * 60 * MIN);
    expect(intervalToMs("2.5mo")).toBe(2.5 * 30 * 24 * 60 * MIN);
    expect(intervalToMs("1y")).toBe(365 * 24 * 60 * MIN);
    expect(intervalToMs("10 min")).toBe(10 * MIN);
  });
  it("tells minutes from months and rejects junk", () => {
    expect(intervalToMs("3mo")).not.toBe(intervalToMs("3m"));
    expect(intervalToMs("")).toBeNull();
    expect(intervalToMs(null)).toBeNull();
    expect(intervalToMs("soon")).toBeNull();
    expect(intervalToMs("5 parsecs")).toBeNull();
  });
});

describe("keyToRating", () => {
  it("maps 1-4 only", () => {
    expect(keyToRating("1")).toBe(1);
    expect(keyToRating("4")).toBe(4);
    expect(keyToRating("5")).toBeNull();
    expect(keyToRating(" ")).toBeNull();
  });
});

describe("text helpers", () => {
  it("formats durations", () => {
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(4 * MIN + 12_000)).toBe("4m 12s");
    expect(formatDuration(5 * MIN)).toBe("5m");
    expect(formatDuration(63 * MIN)).toBe("1h 3m");
    expect(formatDuration(-5)).toBe("0s");
  });
  it("writes streaks and due summaries", () => {
    expect(streakText(0)).toBeNull();
    expect(streakText(1)).toBe("1-day streak");
    expect(streakText(4)).toBe("4-day streak");
    expect(dueSummary({ due: 23, new: 8 })).toBe("23 due · 8 new");
    expect(dueSummary({ due: 0, new: 8 })).toBe("8 new");
    expect(dueSummary({ due: 0, new: 0 })).toBe("Nothing due");
  });
  it("writes the today headline", () => {
    expect(todayHeadline({ due: 3, new: 2, reviewedToday: 0 })).toEqual({ title: "3 due · 2 new", detail: null, hasWork: true });
    const done = todayHeadline({ due: 0, new: 0, reviewedToday: 12 });
    expect(done.hasWork).toBe(false);
    expect(done.title).toBe("All caught up for today");
    expect(done.detail).toContain("12 cards");
  });
  it("labels a card's schedule", () => {
    expect(dueText(state("new"), NOW)).toBe("New");
    expect(dueText(state("review", "2026-10-19T00:00:00Z"), NOW)).toBe("Due now");
    expect(dueText(state("review", "2026-10-24T12:00:00Z"), NOW)).toBe("Due in 4d");
    expect(dueText(state("learning", "2026-10-20T12:10:00Z"), NOW)).toBe("Due in 10m");
    expect(dueText(state("review", "2026-10-20T15:00:00Z"), NOW)).toBe("Due in 3h");
  });
  it("reads page numbers and sizes long fronts down", () => {
    expect(pageOfLocation("Page 3")).toBe(3);
    expect(pageOfLocation("Slide 2")).toBeNull();
    expect(pageOfLocation(null)).toBeNull();
    expect(frontFontSize("short").base).toBe("1.5rem");
    expect(frontFontSize("x".repeat(600)).base).toBe("1rem");
  });
});

describe("validateCard", () => {
  it("needs a front and a back", () => {
    expect(validateCard({ front: " ", back: "", hint: "" })).toEqual({ front: "Write the question or prompt", back: "Write the answer" });
    expect(validateCard({ front: "Q", back: "A", hint: "" })).toEqual({});
  });
  it("caps every field at 2000 characters", () => {
    const long = "x".repeat(2001);
    expect(Object.keys(validateCard({ front: long, back: long, hint: long }))).toEqual(["front", "back", "hint"]);
    expect(validateCard({ front: "x".repeat(2000), back: "A", hint: "" })).toEqual({});
  });
});

describe("cardMatches", () => {
  const c = { front: "Which nerve supplies the deltoid?", back: "Axillary nerve (C5, C6)", hint: "Surgical neck" };
  it("matches every word anywhere, ignoring case", () => {
    expect(cardMatches(c, "")).toBe(true);
    expect(cardMatches(c, "axillary DELTOID")).toBe(true);
    expect(cardMatches(c, "surgical")).toBe(true);
    expect(cardMatches(c, "radial")).toBe(false);
  });
});

describe("permissions", () => {
  const shared = { kind: "ai" as const, createdBy: "u1", isPrivate: false };
  it("lets anyone add to manual decks, creators and owners to others", () => {
    expect(canEditCards({ ...shared, kind: "manual" }, "u2", "member")).toBe(true);
    expect(canEditCards(shared, "u1", "member")).toBe(true);
    expect(canEditCards(shared, "u2", "member")).toBe(false);
    expect(canEditCards(shared, "u2", "owner")).toBe(true);
  });
  it("keeps private decks to their owner", () => {
    const mine = { kind: "mistakes" as const, createdBy: "u1", isPrivate: true };
    expect(canEditCards(mine, "u2", "owner")).toBe(false);
    expect(canDeleteDeck(mine, "u2", "owner")).toBe(false);
    expect(canDeleteDeck(mine, "u1", "member")).toBe(true);
    expect(canDeleteDeck(shared, "u2", "owner")).toBe(true);
    expect(canDeleteDeck(shared, "u2", "member")).toBe(false);
  });
});

describe("review session", () => {
  const start = (cards: Flashcard[], counts = { due: cards.filter(c => c.state.status !== "new").length, new: cards.filter(c => c.state.status === "new").length }) =>
    startSession(cards, counts, NOW);

  it("starts with the server's first card and counts what's left", () => {
    const s = start([card("a"), card("b"), card("c", "new")]);
    expect(ids(s)).toEqual(["a", "b", "c"]);
    expect(sessionCounts(s)).toEqual({ new: 1, learning: 0, due: 2, total: 3 });
    expect(sessionProgress(s)).toBe(0);
  });

  it("handles an empty queue", () => {
    const s = start([]);
    expect(s.current).toBeNull();
    expect(s.finishedAt).toBe(NOW);
    expect(sessionProgress(s)).toBe(100);
  });

  it("drops duplicate cards from the server", () => {
    expect(ids(start([card("a"), card("a"), card("b")]))).toEqual(["a", "b"]);
  });

  it("moves on after Good and brings Again back later in the session", () => {
    let s = start([card("a"), card("b"), card("c")]);
    s = sessionReducer(s, { type: "rate", rating: 3, intervalMs: 4 * 24 * 60 * MIN, now: NOW });
    expect(ids(s)).toEqual(["b", "c"]);
    s = sessionReducer(s, { type: "rate", rating: 1, intervalMs: 30_000, now: NOW });
    expect(s.current?.card.id).toBe("c");
    expect(s.queue).toHaveLength(1);
    expect(s.queue[0]).toMatchObject({ dueAt: NOW + 30_000 });
    expect(sessionCounts(s).learning).toBe(1);
    expect(s.reviewed).toBe(2);
    expect(s.again).toBe(1);
    // Nothing else left: the learning card is shown early (learn ahead).
    s = sessionReducer(s, { type: "rate", rating: 3, intervalMs: 24 * 60 * MIN, now: NOW + 1000 });
    expect(s.current?.card.id).toBe("b");
    s = sessionReducer(s, { type: "rate", rating: 3, intervalMs: 24 * 60 * MIN, now: NOW + 2000 });
    expect(s.current).toBeNull();
    expect(s.finishedAt).toBe(NOW + 2000);
    expect(sessionProgress(s)).toBe(100);
  });

  it("shows a learning card that has come due before the rest of the queue", () => {
    let s = start([card("a"), card("b"), card("c"), card("d")]);
    s = sessionReducer(s, { type: "rate", rating: 1, intervalMs: MIN, now: NOW });
    expect(s.current?.card.id).toBe("b");
    s = sessionReducer(s, { type: "rate", rating: 3, intervalMs: null, now: NOW + 2 * MIN });
    expect(s.current?.card.id).toBe("a");
  });

  it("guesses Again comes back when there's no label yet, and doesn't for unknown others", () => {
    let s = start([card("a"), card("b")]);
    s = sessionReducer(s, { type: "rate", rating: 1, intervalMs: null, now: NOW });
    expect(s.queue.map(e => e.card.id)).toEqual(["a"]);
    s = sessionReducer(s, { type: "rate", rating: 2, intervalMs: null, now: NOW });
    expect(s.queue.map(e => e.card.id)).toEqual([]);
    expect(s.current?.card.id).toBe("a");
  });

  it("doesn't keep cards that come back after the learn-ahead window", () => {
    let s = start([card("a"), card("b")]);
    s = sessionReducer(s, { type: "rate", rating: 2, intervalMs: LEARN_AHEAD_MS + 1, now: NOW });
    expect(s.queue).toHaveLength(0);
  });

  it("reconciles with the server's schedule", () => {
    let s = start([card("a"), card("b"), card("c")]);
    s = sessionReducer(s, { type: "rate", rating: 1, intervalMs: 30_000, now: NOW });
    // Server: actually due in 5 minutes.
    s = sessionReducer(s, { type: "reconcile", cardId: "a", state: state("learning", new Date(NOW + 5 * MIN).toISOString()), now: NOW });
    expect(s.queue.find(e => e.card.id === "a")).toMatchObject({ dueAt: NOW + 5 * MIN, card: { state: { status: "learning" } } });
    // We thought Good on b was done; the server says it's back in 10 minutes.
    s = sessionReducer(s, { type: "rate", rating: 3, intervalMs: null, now: NOW });
    s = sessionReducer(s, { type: "reconcile", cardId: "b", state: state("learning", new Date(NOW + 10 * MIN).toISOString()), now: NOW });
    expect(s.queue.map(e => e.card.id)).toContain("b");
    // And a is graduated after all: drop it.
    s = sessionReducer(s, { type: "reconcile", cardId: "a", state: state("review", new Date(NOW + 2 * 24 * 60 * MIN).toISOString()), now: NOW });
    expect(s.queue.map(e => e.card.id)).toEqual(["b"]);
  });

  it("updates the card on screen without moving it", () => {
    let s = start([card("a"), card("b")]);
    s = sessionReducer(s, { type: "reconcile", cardId: "a", state: state("relearning", null), now: NOW });
    expect(s.current?.card.state.status).toBe("relearning");
    expect(ids(s)).toEqual(["a", "b"]);
  });

  it("tops up from the server without repeating cards", () => {
    let s = start([card("a"), card("b")], { due: 5, new: 0 });
    expect(s.backlog).toEqual({ due: 3, new: 0 });
    expect(needsTopUp(s)).toBe(true);
    expect(sessionCounts(s).total).toBe(5);
    s = sessionReducer(s, { type: "topUp", cards: [card("b"), card("c"), card("d"), card("e")], counts: { due: 4, new: 0 }, now: NOW });
    expect(ids(s)).toEqual(["a", "b", "c", "d", "e"]);
    expect(s.backlog).toEqual({ due: 0, new: 0 });
    expect(needsTopUp(s)).toBe(false);
  });

  it("stops asking when a top-up brings nothing new", () => {
    let s = start([card("a")], { due: 3, new: 0 });
    s = sessionReducer(s, { type: "topUp", cards: [card("a")], counts: { due: 3, new: 0 }, now: NOW });
    expect(needsTopUp(s)).toBe(false);
  });

  it("carries on when a top-up arrives after running dry", () => {
    let s = start([card("a")], { due: 2, new: 0 });
    s = sessionReducer(s, { type: "rate", rating: 3, intervalMs: null, now: NOW });
    expect(s.current).toBeNull();
    s = sessionReducer(s, { type: "topUp", cards: [card("b")], counts: { due: 1, new: 0 }, now: NOW });
    expect(s.current?.card.id).toBe("b");
    expect(s.finishedAt).toBeNull();
  });

  it("resumes with a card the server brought back after the end", () => {
    let s = start([card("a")]);
    s = sessionReducer(s, { type: "rate", rating: 3, intervalMs: null, now: NOW });
    s = sessionReducer(s, { type: "reconcile", cardId: "a", state: state("learning", new Date(NOW + MIN).toISOString()), now: NOW });
    expect(s.current).toBeNull();
    expect(s.queue).toHaveLength(1);
    s = sessionReducer(s, { type: "resume", now: NOW });
    expect(s.current?.card.id).toBe("a");
  });

  it("peeks at the next card", () => {
    const s = start([card("a"), card("b")]);
    expect(upcomingCard(s, NOW)?.id).toBe("b");
    expect(nextIndex([], NOW)).toBe(-1);
  });
});
