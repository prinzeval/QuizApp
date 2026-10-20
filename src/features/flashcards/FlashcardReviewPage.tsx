import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, Center, EmptyState, Group, Loader, Text, VisuallyHidden } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useDecks, useFlashcardsLive } from "../../hooks/flashcards.ts";
import { usePageTitle } from "../../hooks/usePageTitle.ts";
import { useRoomLive } from "../../realtime/useRoomLive.ts";
import { ApiError } from "../../lib/api.ts";
import { flashcardsApi } from "../../lib/flashcardsApi.ts";
import { ReviewSession } from "./ReviewSession.tsx";

/** The review queue for a session. Kept outside the room's keys on purpose: live room updates mustn't reshuffle a session. */
const reviewQueueKey = (roomId: string, deckId: string | null, run: number) => ["flashcardsReview", roomId, deckId ?? "all", run] as const;

/** /rooms/:roomId/flashcards/review?deckId= — a focused review session (one deck, or every deck in the room). */
export function FlashcardReviewPage() {
  const { roomId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const deckId = searchParams.get("deckId");
  // Joins the room channel (deck changes, room deletion) while reviewing.
  useRoomLive(roomId);
  useFlashcardsLive(roomId);
  const decks = useDecks(roomId);
  const deck = deckId ? decks.data?.decks.find(d => d.id === deckId) : null;
  usePageTitle(deck ? `Review: ${deck.title}` : "Flashcard review");
  const [run, setRun] = useState(0);

  const queue = useQuery({
    queryKey: reviewQueueKey(roomId, deckId, run),
    queryFn: () => flashcardsApi.reviewQueue(roomId, deckId),
    enabled: !!roomId,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const decksHref = `/rooms/${roomId}?tab=flashcards`;
  const title = deckId ? deck?.title ?? "Deck" : "All decks";

  let body;
  if (queue.isPending) {
    body = (
      <Center py={96} role="status">
        <Loader aria-hidden="true" />
        <VisuallyHidden>Loading your cards…</VisuallyHidden>
      </Center>
    );
  } else if (queue.isError) {
    const notFound = queue.error instanceof ApiError && (queue.error.status === 404 || queue.error.status === 403);
    body = (
      <EmptyState
        title={notFound ? "Deck not found" : "Couldn't load your cards"}
        description={notFound ? "It may have been deleted." : queue.error.message}
        py={56}
        bd="1px dashed var(--mantine-color-default-border)"
        bdrs="lg"
      >
        <EmptyState.Actions>
          {!notFound && (
            <Button variant="default" onClick={() => queue.refetch()}>
              Try again
            </Button>
          )}
          <Button component={Link} to={decksHref} variant={notFound ? "default" : "subtle"}>
            Back to flashcards
          </Button>
        </EmptyState.Actions>
      </EmptyState>
    );
  } else {
    body = (
      <ReviewSession
        key={run}
        roomId={roomId}
        deckId={deckId}
        initial={queue.data}
        decksHref={decksHref}
        streakDays={decks.data?.today.streakDays ?? null}
        onRestart={() => setRun(n => n + 1)}
      />
    );
  }

  return (
    <Box maw={720} mx="auto">
      <Group component="nav" aria-label="Breadcrumb" gap={2} mb="md" ml={-8} wrap="nowrap" miw={0}>
        <Button
          component={Link}
          to={decksHref}
          variant="subtle"
          color="gray"
          c="dimmed"
          fw={500}
          size="sm"
          px={8}
          miw={0}
          leftSection={<IconArrowLeft size={14} aria-hidden="true" />}
          styles={{ label: { overflow: "hidden", textOverflow: "ellipsis" } }}
          data-testid="review-back"
        >
          <Text span inherit truncate>
            Flashcards · {title}
          </Text>
        </Button>
      </Group>
      {body}
    </Box>
  );
}
