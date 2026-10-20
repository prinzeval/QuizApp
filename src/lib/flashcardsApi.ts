import type { Box, FigurePlacement } from "./learningApi.ts";
import { request } from "./api.ts";

const room = (roomId: string) => `/app/rooms/${encodeURIComponent(roomId)}`;
const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

/* ------------------------------------------------------------------ types */

export type DeckKind = "ai" | "manual" | "mistakes";
export type DeckStatus = "generating" | "ready" | "failed";

/** My own schedule for a deck: how many of its cards are due, new, learning or in review. */
export interface DeckCounts {
  due: number;
  new: number;
  learning: number;
  review: number;
}

export interface FlashcardDeck {
  id: string;
  roomId: string;
  title: string;
  kind: DeckKind;
  status: DeckStatus;
  error: string | null;
  createdBy: string | null;
  creatorName: string | null;
  createdAt: string;
  cardCount: number;
  /** "My mistakes" decks are only visible to the person they belong to. */
  isPrivate: boolean;
  materials: { id: string; title: string }[];
  mine: DeckCounts;
}

export type CardStatus = "new" | "learning" | "review" | "relearning";

/** One member's schedule for a card (everyone in the room has their own). */
export interface CardState {
  status: CardStatus;
  due: string | null;
  reps: number;
  lapses: number;
  lastReview: string | null;
}

export interface FlashcardSource {
  materialId: string;
  materialTitle: string;
  location: string | null;
}

export interface Flashcard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  hint: string | null;
  source: FlashcardSource | null;
  figureId: string | null;
  /** The picture for cards made from picture questions, with printed labels covered. */
  figure: (FigurePlacement & { masks: Box[] }) | null;
  createdAt: string;
  state: CardState;
}

/** 1 Again, 2 Hard, 3 Good, 4 Easy. */
export type Rating = 1 | 2 | 3 | 4;

/** What each rating button would schedule next, e.g. { 1: "<1m", 2: "10m", 3: "1d", 4: "4d" }. */
export type IntervalPreview = Record<Rating, string>;

export interface TodaySummary {
  due: number;
  new: number;
  reviewedToday: number;
  streakDays: number;
}

export interface ReviewQueue {
  cards: Flashcard[];
  counts: { due: number; new: number };
}

export interface CardInput {
  front: string;
  back: string;
  hint?: string;
}

export interface NewAiDeckInput {
  materialIds: string[];
  count: number;
  focus?: string;
}

/* -------------------------------------------------------------------- api */

const decks = (roomId: string) => `${room(roomId)}/flashcards/decks`;

export const flashcardsApi = {
  decks: (roomId: string) => request<{ decks: FlashcardDeck[]; today: TodaySummary }>(decks(roomId)),
  deck: (roomId: string, deckId: string) => request<{ deck: FlashcardDeck; cards: Flashcard[] }>(`${decks(roomId)}/${deckId}`),
  createAiDeck: (roomId: string, input: NewAiDeckInput) => request<{ deck: FlashcardDeck }>(decks(roomId), json("POST", { kind: "ai", ...input })),
  createManualDeck: (roomId: string, title: string) => request<{ deck: FlashcardDeck }>(decks(roomId), json("POST", { kind: "manual", title })),
  createMistakesDeck: (roomId: string) => request<{ deck: FlashcardDeck; added: number }>(`${decks(roomId)}/mistakes`, json("POST")),
  deleteDeck: (roomId: string, deckId: string) => request<unknown>(`${decks(roomId)}/${deckId}`, json("DELETE")),

  addCard: (roomId: string, deckId: string, input: CardInput) =>
    request<{ card: Flashcard }>(`${decks(roomId)}/${deckId}/cards`, json("POST", input)),
  updateCard: (roomId: string, deckId: string, cardId: string, input: CardInput) =>
    request<{ card: Flashcard }>(`${decks(roomId)}/${deckId}/cards/${cardId}`, json("PUT", input)),
  deleteCard: (roomId: string, deckId: string, cardId: string) => request<unknown>(`${decks(roomId)}/${deckId}/cards/${cardId}`, json("DELETE")),

  reviewQueue: (roomId: string, deckId: string | null, limit = 50) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (deckId) params.set("deckId", deckId);
    return request<ReviewQueue>(`${room(roomId)}/flashcards/review?${params}`);
  },
  review: (roomId: string, cardId: string, input: { rating: Rating; durationMs?: number }) =>
    request<{ state: CardState; next: IntervalPreview }>(`${room(roomId)}/flashcards/cards/${cardId}/review`, json("POST", input)),
  preview: (roomId: string, cardId: string) => request<{ next: IntervalPreview }>(`${room(roomId)}/flashcards/cards/${cardId}/preview`),
};
