import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../lib/api.ts";
import {
  flashcardsApi,
  type CardInput,
  type CardState,
  type FlashcardDeck,
  type IntervalPreview,
  type NewAiDeckInput,
  type Rating,
} from "../lib/flashcardsApi.ts";
import { useSocket } from "../realtime/RealtimeProvider.tsx";

/**
 * Flashcard query keys. Decks live under the room's key, so room-wide
 * invalidations refresh them too. Button previews are per card and only
 * change when that card is reviewed.
 */
export const flashcardKeys = {
  all: (roomId: string) => ["rooms", roomId, "flashcards"] as const,
  decks: (roomId: string) => ["rooms", roomId, "flashcards", "decks"] as const,
  deck: (roomId: string, deckId: string) => ["rooms", roomId, "flashcards", "decks", deckId] as const,
  preview: (roomId: string, cardId: string) => ["rooms", roomId, "flashcards", "preview", cardId] as const,
};

/* ------------------------------------------------------------------ decks */

export function useDecks(roomId: string) {
  const query = useQuery({ queryKey: flashcardKeys.decks(roomId), queryFn: () => flashcardsApi.decks(roomId), enabled: !!roomId });
  const generating = query.data?.decks.some(deck => deck.status === "generating") ?? false;
  const queryClient = useQueryClient();
  // Belt and braces: if the live connection drops, still notice when a deck finishes.
  useEffect(() => {
    if (!generating) return;
    const timer = setInterval(() => queryClient.invalidateQueries({ queryKey: flashcardKeys.decks(roomId), exact: true }), 5000);
    return () => clearInterval(timer);
  }, [generating, queryClient, roomId]);
  return query;
}

export function useDeck(roomId: string, deckId: string | null) {
  return useQuery({
    queryKey: flashcardKeys.deck(roomId, deckId ?? ""),
    queryFn: () => flashcardsApi.deck(roomId, deckId!),
    enabled: !!roomId && !!deckId,
  });
}

function useInvalidateDecks(roomId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: flashcardKeys.decks(roomId) });
}

export function useCreateAiDeck(roomId: string) {
  const invalidate = useInvalidateDecks(roomId);
  return useMutation({ mutationFn: (input: NewAiDeckInput) => flashcardsApi.createAiDeck(roomId, input), onSuccess: invalidate });
}

export function useCreateManualDeck(roomId: string) {
  const invalidate = useInvalidateDecks(roomId);
  return useMutation({ mutationFn: (title: string) => flashcardsApi.createManualDeck(roomId, title), onSuccess: invalidate });
}

export function useCreateMistakesDeck(roomId: string) {
  const invalidate = useInvalidateDecks(roomId);
  return useMutation({ mutationFn: () => flashcardsApi.createMistakesDeck(roomId), onSuccess: invalidate });
}

export function useDeleteDeck(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deckId: string) => flashcardsApi.deleteDeck(roomId, deckId),
    onSuccess: (_, deckId) => {
      queryClient.setQueryData<{ decks: FlashcardDeck[] }>(flashcardKeys.decks(roomId), current =>
        current ? { ...current, decks: current.decks.filter(deck => deck.id !== deckId) } : current,
      );
      queryClient.removeQueries({ queryKey: flashcardKeys.deck(roomId, deckId) });
      return queryClient.invalidateQueries({ queryKey: flashcardKeys.decks(roomId), exact: true });
    },
  });
}

/* ------------------------------------------------------------------ cards */

export function useSaveCard(roomId: string, deckId: string) {
  const invalidate = useInvalidateDecks(roomId);
  return useMutation({
    mutationFn: ({ cardId, input }: { cardId: string | null; input: CardInput }) =>
      cardId ? flashcardsApi.updateCard(roomId, deckId, cardId, input) : flashcardsApi.addCard(roomId, deckId, input),
    onSuccess: invalidate,
  });
}

export function useDeleteCard(roomId: string, deckId: string) {
  const invalidate = useInvalidateDecks(roomId);
  return useMutation({ mutationFn: (cardId: string) => flashcardsApi.deleteCard(roomId, deckId, cardId), onSuccess: invalidate });
}

/** The interval each rating button would give this card ("<1m", "10m", "1d", "4d"). */
export function useCardPreview(roomId: string, cardId: string | null, enabled = true) {
  return useQuery({
    queryKey: flashcardKeys.preview(roomId, cardId ?? ""),
    queryFn: () => flashcardsApi.preview(roomId, cardId!).then(data => data.next),
    enabled: enabled && !!roomId && !!cardId,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function usePrefetchPreview(roomId: string) {
  const queryClient = useQueryClient();
  return useCallback(
    (cardId: string) =>
      queryClient.prefetchQuery({
        queryKey: flashcardKeys.preview(roomId, cardId),
        queryFn: () => flashcardsApi.preview(roomId, cardId).then(data => data.next),
        staleTime: Infinity,
      }),
    [queryClient, roomId],
  );
}

/* --------------------------------------------------------------- realtime */

/**
 * Refreshes decks when anyone in the room creates, finishes, deletes or edits
 * one. Needs the room's channel joined (useRoomLive does that).
 */
export function useFlashcardsLive(roomId: string) {
  const socket = useSocket();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!socket || !roomId) return;
    const onUpdated = (payload: { roomId?: string; deckId?: string }) => {
      if (payload.roomId !== roomId) return;
      queryClient.invalidateQueries({ queryKey: flashcardKeys.decks(roomId), exact: true });
      if (payload.deckId) queryClient.invalidateQueries({ queryKey: flashcardKeys.deck(roomId, payload.deckId), exact: true });
    };
    socket.on("flashcards:updated", onUpdated);
    return () => {
      socket.off("flashcards:updated", onUpdated);
    };
  }, [socket, roomId, queryClient]);
}

/* ----------------------------------------------------------- review sync */

export interface PendingReview {
  cardId: string;
  rating: Rating;
  durationMs: number;
  /** Increases each time this card is rated, so only the latest answer is applied. */
  seq: number;
}

const transient = (error: unknown) => !(error instanceof ApiError) || error.status === 0 || error.status === 429 || error.status >= 500;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Sends ratings in the background, one at a time and in order, so the next
 * card never waits on the network. Network hiccups are retried; anything that
 * still fails is kept so the page can offer to try again.
 */
export function useReviewSync(roomId: string, onSaved: (review: PendingReview, state: CardState) => void) {
  const queryClient = useQueryClient();
  const queue = useRef<PendingReview[]>([]);
  const running = useRef(false);
  const alive = useRef(true);
  const latestSaved = useRef(onSaved);
  latestSaved.current = onSaved;
  const [pending, setPending] = useState<string[]>([]);
  const [failed, setFailed] = useState<{ review: PendingReview; message: string }[]>([]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const sync = () => setPending(queue.current.map(review => review.cardId));

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    while (queue.current.length > 0 && alive.current) {
      const review = queue.current[0];
      for (let attempt = 1; ; attempt++) {
        try {
          const result = await flashcardsApi.review(roomId, review.cardId, { rating: review.rating, durationMs: review.durationMs });
          queryClient.setQueryData<IntervalPreview>(flashcardKeys.preview(roomId, review.cardId), result.next);
          latestSaved.current(review, result.state);
          break;
        } catch (error) {
          if (transient(error) && attempt < 3 && alive.current) {
            await wait(800 * attempt);
            continue;
          }
          const message = error instanceof Error ? error.message : "Couldn't save this review.";
          // A card deleted mid-session can't be reviewed; nothing to retry.
          if (!(error instanceof ApiError && error.status === 404)) setFailed(list => [...list, { review, message }]);
          break;
        }
      }
      queue.current.shift();
      sync();
    }
    running.current = false;
    if (alive.current) queryClient.invalidateQueries({ queryKey: flashcardKeys.decks(roomId) });
  }, [queryClient, roomId]);

  const enqueue = useCallback(
    (review: PendingReview) => {
      queue.current.push(review);
      sync();
      void run();
    },
    [run],
  );

  const failedRef = useRef(failed);
  failedRef.current = failed;
  const retryFailed = useCallback(() => {
    queue.current.push(...failedRef.current.map(entry => entry.review));
    setFailed([]);
    sync();
    void run();
  }, [run]);

  const dismissFailed = useCallback(() => setFailed([]), []);

  // Leaving the page with reviews still being saved would lose them.
  useEffect(() => {
    if (pending.length === 0) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pending.length]);

  return { enqueue, pending, failed, retryFailed, dismissFailed };
}
