import type { CardState, DeckCounts, DeckKind, Flashcard, FlashcardDeck, Rating } from "../../lib/flashcardsApi.ts";
import type { FieldErrors, RoomRole } from "../../lib/api.ts";
import { plural } from "../../lib/format.ts";

/* ---------------------------------------------------------------- ratings */

export const RATINGS: { rating: Rating; label: string; color: string }[] = [
  { rating: 1, label: "Again", color: "red" },
  { rating: 2, label: "Hard", color: "orange" },
  { rating: 3, label: "Good", color: "teal" },
  { rating: 4, label: "Easy", color: "blue" },
];

/** "1"–"4" on the keyboard → a rating. */
export function keyToRating(key: string): Rating | null {
  return key === "1" || key === "2" || key === "3" || key === "4" ? (Number(key) as Rating) : null;
}

export const KIND_LABEL: Record<DeckKind, string> = { ai: "AI", manual: "Manual", mistakes: "Mistakes" };

/* ------------------------------------------------------------- intervals */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const UNIT_MS: [RegExp, number][] = [
  [/^(s|sec|secs|second|seconds)$/, 1000],
  [/^(m|min|mins|minute|minutes)$/, MINUTE],
  [/^(h|hr|hrs|hour|hours)$/, HOUR],
  [/^(d|day|days)$/, DAY],
  [/^(w|wk|wks|week|weeks)$/, 7 * DAY],
  [/^(mo|mos|month|months)$/, 30 * DAY],
  [/^(y|yr|yrs|year|years)$/, 365 * DAY],
];

/**
 * An interval label from the server ("<1m", "10m", "1d", "4d", "2.5mo") in ms,
 * or null when it can't be read. "<1m" counts as half a minute.
 */
export function intervalToMs(label: string | null | undefined): number | null {
  const match = label?.trim().toLowerCase().match(/^(<\s*)?(\d+(?:\.\d+)?)\s*([a-z]+)$/);
  if (!match) return null;
  const [, lessThan, amount, unit] = match;
  const size = UNIT_MS.find(([pattern]) => pattern.test(unit))?.[1];
  if (size === undefined) return null;
  const ms = Number(amount) * size;
  return lessThan ? ms / 2 : ms;
}

/** Cards coming back within this long are shown again in the same session (Anki's "learn ahead"). */
export const LEARN_AHEAD_MS = 20 * MINUTE;

/** Time spent on a card is capped, so walking away doesn't skew the stats. */
export const MAX_ANSWER_MS = 60_000;

/** "45s", "4m 12s", "1h 3m". */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return seconds % 60 ? `${minutes}m ${seconds % 60}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
}

/** "in 3h", "in 2d", "now": a short relative time, for "next due" style labels. */
export function shortUntil(iso: string, now = Date.now()): string {
  const ms = Date.parse(iso) - now;
  if (!Number.isFinite(ms) || ms <= MINUTE) return "now";
  if (ms < HOUR) return `in ${Math.round(ms / MINUTE)}m`;
  if (ms < DAY) return `in ${Math.round(ms / HOUR)}h`;
  if (ms < 60 * DAY) return `in ${Math.round(ms / DAY)}d`;
  if (ms < 365 * DAY) return `in ${Math.round(ms / (30 * DAY))}mo`;
  return `in ${Math.round(ms / (365 * DAY))}y`;
}

/** The browser's line for a card's schedule: "New", "Due now", "Due in 4d". */
export function dueText(state: CardState, now = Date.now()): string {
  if (state.status === "new") return "New";
  if (!state.due) return "Due now";
  const when = shortUntil(state.due, now);
  return when === "now" ? "Due now" : `Due ${when}`;
}

export const STATUS_LABEL: Record<CardState["status"], string> = { new: "New", learning: "Learning", review: "Review", relearning: "Relearning" };
export const STATUS_COLOR: Record<CardState["status"], string> = { new: "blue", learning: "orange", review: "teal", relearning: "orange" };

/* ------------------------------------------------------------- summaries */

/** "4-day streak", or null with no streak yet. */
export function streakText(days: number): string | null {
  return days > 0 ? `${days}-day streak` : null;
}

/** "3 due · 5 new", or "Nothing due" for a deck. */
export function dueSummary(counts: Pick<DeckCounts, "due" | "new">): string {
  const parts = [counts.due > 0 ? `${counts.due} due` : null, counts.new > 0 ? `${counts.new} new` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Nothing due";
}

/** The "today" headline: "23 due · 8 new", or the caught-up line. */
export function todayHeadline(today: { due: number; new: number; reviewedToday: number }): { title: string; detail: string | null; hasWork: boolean } {
  const hasWork = today.due + today.new > 0;
  if (hasWork) {
    return {
      title: dueSummary(today),
      detail: today.reviewedToday > 0 ? `${plural(today.reviewedToday, "card")} reviewed so far today` : null,
      hasWork,
    };
  }
  return {
    title: "All caught up for today",
    detail: today.reviewedToday > 0 ? `You reviewed ${plural(today.reviewedToday, "card")} today. Nice work.` : null,
    hasWork,
  };
}

/* ---------------------------------------------------------- permissions */

/** Adding/editing cards: anyone on a manual deck, your own decks, and the room owner. */
export function canEditCards(deck: Pick<FlashcardDeck, "kind" | "createdBy" | "isPrivate">, userId: string | undefined, role: RoomRole): boolean {
  if (deck.isPrivate) return !!userId && deck.createdBy === userId;
  return deck.kind === "manual" || (!!userId && deck.createdBy === userId) || role === "owner";
}

/** Deleting a deck: its creator or the room owner; a private deck only by its owner. */
export function canDeleteDeck(deck: Pick<FlashcardDeck, "createdBy" | "isPrivate">, userId: string | undefined, role: RoomRole): boolean {
  if (deck.isPrivate) return !!userId && deck.createdBy === userId;
  return role === "owner" || (!!userId && deck.createdBy === userId);
}

/* ------------------------------------------------------------- editing */

export const CARD_MAX = 2000;

export interface CardDraft {
  front: string;
  back: string;
  hint: string;
}

/** Front and back are required; every field is at most 2000 characters. */
export function validateCard(draft: CardDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (!draft.front.trim()) errors.front = "Write the question or prompt";
  else if (draft.front.trim().length > CARD_MAX) errors.front = `Keep it under ${CARD_MAX} characters`;
  if (!draft.back.trim()) errors.back = "Write the answer";
  else if (draft.back.trim().length > CARD_MAX) errors.back = `Keep it under ${CARD_MAX} characters`;
  if (draft.hint.trim().length > CARD_MAX) errors.hint = `Keep it under ${CARD_MAX} characters`;
  return errors;
}

/** Search the browser: every word must appear in the front, back or hint. */
export function cardMatches(card: Pick<Flashcard, "front" | "back" | "hint">, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = `${card.front}\n${card.back}\n${card.hint ?? ""}`.toLowerCase();
  return words.every(word => text.includes(word));
}

/** Long fronts get a smaller face so they still fit on a phone. */
export function frontFontSize(text: string): { base: string; sm: string } {
  const length = text.length;
  if (length <= 80) return { base: "1.5rem", sm: "1.875rem" };
  if (length <= 220) return { base: "1.25rem", sm: "1.5rem" };
  if (length <= 500) return { base: "1.0625rem", sm: "1.25rem" };
  return { base: "1rem", sm: "1.0625rem" };
}

/** "Page 3" → 3 (for opening the file at the right page). */
export function pageOfLocation(location: string | null | undefined): number | null {
  const match = location?.match(/\bpage\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

/* -------------------------------------------------------- review session */

export interface SessionEntry {
  card: Flashcard;
  /**
   * null: from the server's queue (shown in its order).
   * A time (ms): a card rated this session that comes back soon (learning steps).
   */
  dueAt: number | null;
}

export interface SessionState {
  current: SessionEntry | null;
  queue: SessionEntry[];
  /** Every card this session has loaded (by id), so top-ups never repeat one and late answers can bring one back. */
  known: Record<string, Flashcard>;
  /** Due/new cards the server has that aren't loaded yet. */
  backlog: { due: number; new: number };
  reviewed: number;
  again: number;
  startedAt: number;
  finishedAt: number | null;
}

export type SessionAction =
  | { type: "rate"; rating: Rating; intervalMs: number | null; now: number }
  | { type: "reconcile"; cardId: string; state: CardState; now: number }
  | { type: "topUp"; cards: Flashcard[]; counts: { due: number; new: number }; now: number }
  | { type: "resume"; now: number };

const isLearning = (state: CardState) => state.status === "learning" || state.status === "relearning";

/** Start a session from the server's queue (already in the right order). */
export function startSession(cards: Flashcard[], counts: { due: number; new: number }, now: number): SessionState {
  const fresh = uniqueCards(cards).map(card => ({ card, dueAt: null }));
  const base: SessionState = {
    current: null,
    queue: fresh,
    known: Object.fromEntries(fresh.map(entry => [entry.card.id, entry.card])),
    backlog: backlogAfter(counts, fresh),
    reviewed: 0,
    again: 0,
    startedAt: now,
    finishedAt: null,
  };
  return advance(base, now);
}

function uniqueCards(cards: Flashcard[]): Flashcard[] {
  const ids = new Set<string>();
  return cards.filter(card => !ids.has(card.id) && ids.add(card.id));
}

function backlogAfter(counts: { due: number; new: number }, loaded: SessionEntry[]): { due: number; new: number } {
  const loadedNew = loaded.filter(entry => entry.card.state.status === "new").length;
  return { due: Math.max(0, counts.due - (loaded.length - loadedNew)), new: Math.max(0, counts.new - loadedNew) };
}

/**
 * Which queued card to show next: a learning card that's due now, then the
 * server's queue in order, then (nothing else left) the learning card that
 * comes back soonest, like Anki's learn-ahead.
 */
export function nextIndex(queue: SessionEntry[], now: number): number {
  let soonest = -1;
  for (let i = 0; i < queue.length; i++) {
    const dueAt = queue[i].dueAt;
    if (dueAt !== null && dueAt <= now && (soonest === -1 || dueAt < queue[soonest].dueAt!)) soonest = i;
  }
  if (soonest !== -1) return soonest;
  const fresh = queue.findIndex(entry => entry.dueAt === null);
  if (fresh !== -1) return fresh;
  for (let i = 0; i < queue.length; i++) {
    if (soonest === -1 || queue[i].dueAt! < queue[soonest].dueAt!) soonest = i;
  }
  return soonest;
}

function advance(state: SessionState, now: number): SessionState {
  const index = nextIndex(state.queue, now);
  if (index === -1) return { ...state, current: null, finishedAt: state.finishedAt ?? now };
  return { ...state, current: state.queue[index], queue: state.queue.filter((_, i) => i !== index), finishedAt: null };
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "rate": {
      if (!state.current) return state;
      const { card } = state.current;
      // Comes back within the learn-ahead window: keep it in this session.
      const guess = action.intervalMs ?? (action.rating === 1 ? MINUTE : null);
      const comesBack = guess !== null && guess <= LEARN_AHEAD_MS;
      const queue = comesBack ? [...state.queue, { card, dueAt: action.now + guess }] : state.queue;
      return advance(
        { ...state, current: null, queue, reviewed: state.reviewed + 1, again: state.again + (action.rating === 1 ? 1 : 0) },
        action.now,
      );
    }
    case "reconcile": {
      // The server's answer for a review: trust its schedule over our guess.
      const { cardId, state: cardState, now } = action;
      if (state.current?.card.id === cardId) {
        return { ...state, current: { ...state.current, card: { ...state.current.card, state: cardState } } };
      }
      const due = cardState.due ? Date.parse(cardState.due) : null;
      const soon = isLearning(cardState) && due !== null && Number.isFinite(due) && due <= now + LEARN_AHEAD_MS;
      const index = state.queue.findIndex(entry => entry.card.id === cardId);
      if (index === -1) {
        if (!soon) return state;
        // We guessed it wouldn't come back, but it does: add it (shown after the end screen's "Keep going" if finished).
        const card = state.known[cardId];
        if (!card) return state;
        return { ...state, queue: [...state.queue, { card: { ...card, state: cardState }, dueAt: due }] };
      }
      if (!soon) return { ...state, queue: state.queue.filter((_, i) => i !== index) };
      return {
        ...state,
        queue: state.queue.map((entry, i) => (i === index ? { card: { ...entry.card, state: cardState }, dueAt: due } : entry)),
      };
    }
    case "topUp": {
      const fresh = uniqueCards(action.cards)
        .filter(card => !state.known[card.id])
        .map(card => ({ card, dueAt: null }));
      // Whatever the server still has beyond this page (nothing new at all: stop asking).
      const backlog = fresh.length === 0 ? { due: 0, new: 0 } : backlogAfter(action.counts, action.cards.map(card => ({ card, dueAt: null })));
      const known = { ...state.known, ...Object.fromEntries(fresh.map(entry => [entry.card.id, entry.card])) };
      const next = { ...state, queue: [...state.queue, ...fresh], known, backlog };
      // Arriving while the session had run dry: carry on.
      return state.current || fresh.length === 0 ? next : advance(next, action.now);
    }
    case "resume":
      return state.current ? state : advance(state, action.now);
  }
}

/** What's left in this session: new, learning and review cards (including the one on screen). */
export function sessionCounts(state: SessionState): { new: number; learning: number; due: number; total: number } {
  const entries = state.current ? [state.current, ...state.queue] : state.queue;
  let fresh = 0;
  let learning = 0;
  let due = 0;
  for (const entry of entries) {
    if (entry.dueAt !== null) learning++;
    else if (entry.card.state.status === "new") fresh++;
    else due++;
  }
  fresh += state.backlog.new;
  due += state.backlog.due;
  return { new: fresh, learning, due, total: fresh + learning + due };
}

/** Session progress from 0 to 100: reviews done against reviews done + still to do. */
export function sessionProgress(state: SessionState): number {
  const left = sessionCounts(state).total;
  const total = state.reviewed + left;
  return total === 0 ? 100 : Math.round((100 * state.reviewed) / total);
}

/** Time to fetch more from the server: few fresh cards left and it has more. */
export function needsTopUp(state: SessionState, threshold = 5): boolean {
  const fresh = state.queue.filter(entry => entry.dueAt === null).length;
  return fresh < threshold && state.backlog.due + state.backlog.new > 0;
}

/** The card after this one, if it's from the server's queue (to fetch its button labels early). */
export function upcomingCard(state: SessionState, now: number): Flashcard | null {
  const index = nextIndex(state.queue, now);
  return index === -1 ? null : state.queue[index].card;
}
