import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, type ReactNode, type Ref } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Anchor,
  Box,
  Button,
  Divider,
  Group,
  Kbd,
  Loader,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconAlertCircle, IconArrowLeft, IconBulb, IconCircleCheck, IconFlame, IconPlayerPlay, IconQuote, IconRotateClockwise } from "@tabler/icons-react";
import { useCardPreview, usePrefetchPreview, useReviewSync, type PendingReview } from "../../hooks/flashcards.ts";
import { useIsMobile } from "../../hooks/useIsMobile.ts";
import { flashcardsApi, type CardState, type Flashcard, type IntervalPreview, type Rating, type ReviewQueue } from "../../lib/flashcardsApi.ts";
import { plural } from "../../lib/format.ts";
import { viewerPath } from "../materials/paths.ts";
import { isActivatable, useQuizKeys } from "../quizzes/playerParts.tsx";
import {
  MAX_ANSWER_MS,
  RATINGS,
  formatDuration,
  frontFontSize,
  intervalToMs,
  keyToRating,
  needsTopUp,
  pageOfLocation,
  sessionCounts,
  sessionProgress,
  sessionReducer,
  startSession,
  streakText,
  upcomingCard,
  type SessionState,
} from "./flashcardUtils.ts";
import classes from "./Flashcards.module.css";
import { FigureCrop } from "../figures/FigureCrop.tsx";

interface ReviewSessionProps {
  roomId: string;
  deckId: string | null;
  initial: ReviewQueue;
  decksHref: string;
  streakDays: number | null;
  onRestart: () => void;
}

/**
 * One review session. Ratings are applied instantly and sent in the background
 * (useReviewSync); the server's schedule then corrects ours. Cards that come
 * back within 20 minutes (learning steps) are shown again before the end.
 */
export function ReviewSession({ roomId, deckId, initial, decksHref, streakDays, onRestart }: ReviewSessionProps) {
  const [state, dispatch] = useReducer(sessionReducer, null, () => startSession(initial.cards, initial.counts, Date.now()));
  const [revealed, setRevealed] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const shownAt = useRef(Date.now());
  const seqs = useRef(new Map<string, number>());
  const mobile = useIsMobile();

  const onSaved = useCallback((review: PendingReview, cardState: CardState) => {
    // Only the newest rating of a card decides its place in the session.
    if (seqs.current.get(review.cardId) === review.seq) dispatch({ type: "reconcile", cardId: review.cardId, state: cardState, now: Date.now() });
  }, []);
  const sync = useReviewSync(roomId, onSaved);

  const current = state.current;
  const card = current?.card ?? null;
  const cardPending = !!card && sync.pending.includes(card.id);
  const preview = useCardPreview(roomId, card?.id ?? null, !cardPending);
  const prefetch = usePrefetchPreview(roomId);

  // A new card on screen (the turn counter also covers the same card coming straight back).
  const turn = `${state.reviewed}:${card?.id ?? ""}`;
  const showRef = useRef<HTMLButtonElement>(null);
  const goodRef = useRef<HTMLButtonElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    shownAt.current = Date.now();
    setRevealed(false);
    setHintShown(false);
    if (!card) return;
    topRef.current?.scrollIntoView({ block: "nearest" });
    showRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn]);

  // Fetch the next card's button labels while this one is being read.
  useEffect(() => {
    const next = upcomingCard(state, Date.now());
    if (next && !sync.pending.includes(next.id)) void prefetch(next.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, prefetch]);

  // Running low: fetch the next page of due/new cards.
  const [topUp, setTopUp] = useState<"idle" | "loading" | "failed">("idle");
  const wantsMore = needsTopUp(state);
  const loadMore = useCallback(() => {
    setTopUp("loading");
    flashcardsApi
      .reviewQueue(roomId, deckId)
      .then(data => {
        dispatch({ type: "topUp", cards: data.cards, counts: data.counts, now: Date.now() });
        setTopUp("idle");
      })
      .catch(() => setTopUp("failed"));
  }, [roomId, deckId]);
  useEffect(() => {
    if (wantsMore && topUp === "idle") loadMore();
  }, [wantsMore, topUp, loadMore]);

  const reveal = () => {
    if (!card || revealed) return;
    setRevealed(true);
    requestAnimationFrame(() => goodRef.current?.focus({ preventScroll: true }));
  };

  const rate = (rating: Rating) => {
    if (!card || !revealed) return;
    const now = Date.now();
    const seq = (seqs.current.get(card.id) ?? 0) + 1;
    seqs.current.set(card.id, seq);
    sync.enqueue({ cardId: card.id, rating, durationMs: Math.min(now - shownAt.current, MAX_ANSWER_MS), seq });
    dispatch({ type: "rate", rating, intervalMs: intervalToMs(preview.data?.[rating]), now });
  };

  useQuizKeys(event => {
    if (!card) return;
    if (event.key === " " || event.key === "Enter") {
      // A focused button handles its own Space/Enter (Show answer, Good).
      if (isActivatable(event)) return;
      event.preventDefault();
      if (revealed) rate(3);
      else reveal();
      return;
    }
    if (!revealed && (event.key === "h" || event.key === "H") && card.hint) {
      setHintShown(true);
      return;
    }
    const rating = keyToRating(event.key);
    if (rating && revealed) {
      event.preventDefault();
      rate(rating);
    }
  }, !!card);

  const counts = sessionCounts(state);
  const failedBanner = sync.failed.length > 0 && (
    <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert" title={`${plural(sync.failed.length, "review")} didn't save`}>
      <Text size="sm">{sync.failed[0].message}</Text>
      <Group gap="xs" mt="xs">
        <Button size="xs" variant="light" color="red" onClick={sync.retryFailed} data-testid="retry-reviews">
          Try again
        </Button>
        <Button size="xs" variant="subtle" color="gray" onClick={sync.dismissFailed}>
          Dismiss
        </Button>
      </Group>
    </Alert>
  );

  if (!card) {
    // Ran out while the next page is on its way.
    if (state.backlog.due + state.backlog.new > 0 && topUp !== "failed") {
      return (
        <Stack align="center" py={96} role="status">
          <Loader aria-hidden="true" />
          <Text size="sm" c="dimmed">
            Getting more cards…
          </Text>
        </Stack>
      );
    }
    return (
      <SessionEnd
        roomId={roomId}
        deckId={deckId}
        state={state}
        pending={sync.pending.length}
        failedBanner={failedBanner}
        streakDays={streakDays}
        decksHref={decksHref}
        loadFailed={topUp === "failed"}
        onRetryLoad={loadMore}
        onResume={() => dispatch({ type: "resume", now: Date.now() })}
        onRestart={onRestart}
      />
    );
  }

  const fontSize = frontFontSize(card.front);

  return (
    <Stack ref={topRef} gap="md" style={{ scrollMarginTop: 24 }}>
      <Stack gap={8}>
        <Group justify="space-between" gap="sm" wrap="nowrap">
          <Text size="sm" c="dimmed" truncate miw={0}>
            {state.reviewed > 0 ? `${state.reviewed} reviewed` : "Recall the answer, then rate yourself"}
          </Text>
          <SessionCounts counts={counts} />
        </Group>
        <Progress value={sessionProgress(state)} size="sm" radius="xl" aria-label={`Session progress: ${state.reviewed} reviewed, ${counts.total} to go`} />
      </Stack>

      <Box className={classes.pile} mt="xs">
        <Box key={turn} className={`${classes.face} ${classes.enter}`} px={{ base: "lg", sm: 40 }} py={{ base: 32, sm: 48 }} mih={mobile ? 240 : 300} data-testid="flashcard">
          <Stack gap="lg" justify="center" mih={revealed ? undefined : mobile ? 176 : 204}>
            <Text
              ff="var(--mantine-font-family-headings)"
              fz={mobile ? fontSize.base : fontSize.sm}
              fw={500}
              lh={1.45}
              ta={card.front.length > 220 ? "left" : "center"}
              style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}
              data-testid="card-front"
            >
              {card.front}
            </Text>

            {card.figure && (
              <Box w="100%" maw={560} mx="auto">
                {/* Labels stay covered on the front; the back shows them answered in words. */}
                <FigureCrop roomId={roomId} figure={card.figure} masks={revealed ? [] : card.figure.masks} maxHeight={mobile ? 220 : 320} label="The picture for this card" />
              </Box>
            )}

            {card.hint && !revealed && (
              <Box ta="center">
                {hintShown ? (
                  <Text size="sm" c="dimmed" fs="italic" className={classes.reveal} style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
                    {card.hint}
                  </Text>
                ) : (
                  <Button variant="subtle" color="gray" size="xs" leftSection={<IconBulb size={14} />} onClick={() => setHintShown(true)} data-testid="show-hint">
                    Show hint
                  </Button>
                )}
              </Box>
            )}

            {revealed && (
              <Stack gap="md" className={classes.reveal}>
                <Divider color="var(--mantine-color-clay-2)" />
                <Text
                  fz={mobile ? "1.0625rem" : "1.1875rem"}
                  lh={1.55}
                  ta={card.back.length > 160 ? "left" : "center"}
                  style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}
                  data-testid="card-back"
                  aria-live="polite"
                >
                  {card.back}
                </Text>
                {card.hint && (
                  <Group gap={6} wrap="nowrap" justify="center" c="dimmed">
                    <IconBulb size={14} style={{ flexShrink: 0 }} aria-hidden="true" />
                    <Text size="sm" inherit style={{ overflowWrap: "anywhere" }}>
                      {card.hint}
                    </Text>
                  </Group>
                )}
                <CardSource roomId={roomId} card={card} />
              </Stack>
            )}
          </Stack>
        </Box>
      </Box>

      {failedBanner}

      <div className={classes.dock}>
        {revealed ? (
          <RatingButtons preview={preview.data ?? null} onRate={rate} goodRef={goodRef} />
        ) : (
          <Button ref={showRef} size="lg" fullWidth onClick={reveal} data-testid="show-answer">
            Show answer
          </Button>
        )}
        <Text size="xs" c="dimmed" ta="center" mt={8} visibleFrom="sm">
          {revealed ? (
            <>
              <Kbd size="xs">1</Kbd> Again · <Kbd size="xs">2</Kbd> Hard · <Kbd size="xs">3</Kbd> or <Kbd size="xs">Space</Kbd> Good · <Kbd size="xs">4</Kbd> Easy
            </>
          ) : (
            <>
              <Kbd size="xs">Space</Kbd> to show the answer{card.hint ? <> · <Kbd size="xs">H</Kbd> for a hint</> : null}
            </>
          )}
        </Text>
      </div>
    </Stack>
  );
}

/** Anki-style counts: new (blue), learning (orange), to review (teal). */
function SessionCounts({ counts }: { counts: ReturnType<typeof sessionCounts> }) {
  const items = [
    { value: counts.new, color: "blue", label: "new" },
    { value: counts.learning, color: "orange", label: "learning" },
    { value: counts.due, color: "teal", label: "to review" },
  ];
  return (
    <Group gap={10} wrap="nowrap" style={{ flexShrink: 0 }} data-testid="session-counts">
      {items.map(item => (
        <Tooltip key={item.label} label={`${item.value} ${item.label}`} withArrow>
          <Text size="sm" fw={700} c={`${item.color}.7`} style={{ fontVariantNumeric: "tabular-nums" }} aria-label={`${item.value} ${item.label}`}>
            {item.value}
          </Text>
        </Tooltip>
      ))}
    </Group>
  );
}

function RatingButtons({
  preview,
  onRate,
  goodRef,
}: {
  preview: IntervalPreview | null;
  onRate: (rating: Rating) => void;
  goodRef: Ref<HTMLButtonElement>;
}) {
  return (
    <SimpleGrid cols={4} spacing={8} className={classes.reveal} role="group" aria-label="How well did you remember it?">
      {RATINGS.map(({ rating, label, color }) => (
        <Button
          key={rating}
          ref={rating === 3 ? goodRef : undefined}
          variant="light"
          color={color}
          size="md"
          px={4}
          className={classes.rating}
          classNames={{ label: classes.ratingInner }}
          onClick={() => onRate(rating)}
          aria-label={`${label}${preview ? `, next in ${preview[rating]}` : ""}`}
          data-testid={`rate-${rating}`}
        >
          <Text span size="xs" fw={500} c="dimmed" style={{ fontVariantNumeric: "tabular-nums" }} aria-hidden="true">
            {preview?.[rating] ?? "·"}
          </Text>
          <Text span size="sm" fw={700} inherit aria-hidden="true">
            {label}
          </Text>
        </Button>
      ))}
    </SimpleGrid>
  );
}

/** "From your notes: Heart lecture · Page 3", opening the file at that page in a new tab (so the session keeps its place). */
function CardSource({ roomId, card }: { roomId: string; card: Flashcard }) {
  const source = card.source;
  if (!source) return null;
  const label = [source.materialTitle || "Your notes", source.location].filter(Boolean).join(" · ");
  return (
    <Group gap={8} wrap="nowrap" justify="center" miw={0}>
      <IconQuote size={16} stroke={1.8} color="var(--mantine-primary-color-filled)" style={{ flexShrink: 0 }} aria-hidden="true" />
      <Text size="sm" c="dimmed" lineClamp={1} miw={0}>
        From your notes:{" "}
        <Anchor
          component={Link}
          to={viewerPath(roomId, source.materialId, pageOfLocation(source.location))}
          target="_blank"
          rel="noopener"
          size="sm"
          fw={600}
          data-testid="card-source"
        >
          {label}
        </Anchor>
      </Text>
    </Group>
  );
}

function SessionEnd({
  roomId,
  deckId,
  state,
  pending,
  failedBanner,
  streakDays,
  decksHref,
  loadFailed,
  onRetryLoad,
  onResume,
  onRestart,
}: {
  roomId: string;
  deckId: string | null;
  state: SessionState;
  pending: number;
  failedBanner: ReactNode;
  streakDays: number | null;
  decksHref: string;
  loadFailed: boolean;
  onRetryLoad: () => void;
  onResume: () => void;
  onRestart: () => void;
}) {
  const saving = pending > 0;
  // Once everything is saved, see whether there's more to do (more new cards, or cards that came due meanwhile).
  const more = useQuery({
    queryKey: ["flashcardsReview", roomId, deckId ?? "all", "more", state.startedAt],
    queryFn: () => flashcardsApi.reviewQueue(roomId, deckId, 1),
    enabled: !saving && state.reviewed > 0,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const moreCount = more.data ? more.data.counts.due + more.data.counts.new : 0;
  const stillLearning = state.queue.length;

  if (state.reviewed === 0 && stillLearning === 0) {
    return (
      <Paper withBorder p="xl" ta="center" data-testid="review-empty">
        <Stack align="center" gap="md">
          <ThemeIcon size={56} radius="xl" variant="light" color="teal">
            <IconCircleCheck size={30} stroke={1.6} />
          </ThemeIcon>
          <div>
            <Title order={1} fz="1.5rem">
              {loadFailed ? "Couldn't load more cards" : "All caught up"}
            </Title>
            <Text c="dimmed" mt="xs">
              {loadFailed ? "Check your connection and try again." : "Nothing is due right now. New cards and reviews show up here when it's their time."}
            </Text>
          </div>
          <Group justify="center" gap="sm">
            {loadFailed && (
              <Button variant="default" onClick={onRetryLoad}>
                Try again
              </Button>
            )}
            <Button component={Link} to={decksHref} leftSection={<IconArrowLeft size={16} />}>
              Back to decks
            </Button>
          </Group>
        </Stack>
      </Paper>
    );
  }

  const elapsed = (state.finishedAt ?? Date.now()) - state.startedAt;
  const remembered = state.reviewed > 0 ? Math.round((100 * (state.reviewed - state.again)) / state.reviewed) : 0;
  const streak = streakText(streakDays ?? 0);

  return (
    <Stack gap="md" data-testid="review-done">
      <Paper withBorder p={{ base: "lg", sm: "xl" }} className={classes.today}>
        <Stack align="center" ta="center" gap="lg">
          <ThemeIcon size={56} radius="xl" variant="light" color="teal">
            <IconCircleCheck size={30} stroke={1.6} />
          </ThemeIcon>
          <div role="status">
            <Title order={1} fz="1.5rem">
              {stillLearning > 0 ? "Almost there" : "Session complete"}
            </Title>
            <Text c="dimmed" mt={4}>
              {stillLearning > 0
                ? `${plural(stillLearning, "card")} you're still learning ${stillLearning === 1 ? "is" : "are"} coming back in a few minutes.`
                : "Nicely done. Come back tomorrow to keep them fresh."}
            </Text>
          </div>
          <SimpleGrid cols={{ base: 2, xs: 4 }} spacing="md" w="100%">
            <Stat label="Reviewed" value={String(state.reviewed)} />
            <Stat label="Time" value={formatDuration(elapsed)} />
            <Stat label="Again" value={String(state.again)} color={state.again > 0 ? "red.7" : undefined} />
            <Stat label="Remembered" value={`${remembered}%`} />
          </SimpleGrid>
          {streak && (
            <Group gap={6} c="orange.7" data-testid="end-streak">
              <IconFlame size={18} stroke={1.8} aria-hidden="true" />
              <Text fw={600} inherit>
                {streak}
              </Text>
            </Group>
          )}
          {saving && (
            <Group gap={8} c="dimmed" role="status">
              <Loader size={14} aria-hidden="true" />
              <Text size="sm" inherit>
                Saving your reviews…
              </Text>
            </Group>
          )}
        </Stack>
      </Paper>

      {failedBanner}

      {loadFailed && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title="Couldn't load the rest of your cards">
          <Button size="xs" variant="light" color="red" mt={4} onClick={onRetryLoad}>
            Try again
          </Button>
        </Alert>
      )}

      <Group justify="center" gap="sm">
        <Button component={Link} to={decksHref} variant="default" leftSection={<IconArrowLeft size={16} />}>
          Back to decks
        </Button>
        {stillLearning > 0 ? (
          <Button leftSection={<IconPlayerPlay size={16} />} onClick={onResume} data-testid="keep-going">
            Keep going
          </Button>
        ) : moreCount > 0 ? (
          <Button leftSection={<IconRotateClockwise size={16} />} onClick={onRestart} data-testid="review-more">
            Review more ({moreCount})
          </Button>
        ) : null}
      </Group>
    </Stack>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Stack gap={0} align="center">
      <Text fw={700} fz="1.5rem" c={color} ff="var(--mantine-font-family-headings)" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Text>
      <Text size="xs" c="dimmed" fw={500}>
        {label}
      </Text>
    </Stack>
  );
}
