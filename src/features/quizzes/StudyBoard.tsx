import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Anchor, Avatar, Badge, Box, Card, Drawer, Group, Indicator, Progress, ScrollArea, Skeleton, Stack, Switch, Text, ThemeIcon, Title, Tooltip, UnstyledButton, VisuallyHidden } from "@mantine/core";
import { useLocalStorage, useMediaQuery } from "@mantine/hooks";
import { IconChevronUp, IconCircleCheck, IconHourglassHigh, IconLock, IconTrophy, IconUsers } from "@tabler/icons-react";
import { useQuizBoard, useSetAttemptSharing } from "../../hooks/learning.ts";
import type { BoardEntry } from "../../lib/learningApi.ts";
import { initials } from "../../lib/format.ts";
import { notify } from "../../notify.ts";
import { UserAvatar } from "../../components/UserAvatar.tsx";
import { SHARE_PREFERENCE_KEY, boardSummary, entryStatus, isActiveRecently, parseSharePreference, rankBoard, sortBoard, statusLabel, type EntryStatus } from "./boardUtils.ts";
import { MODE_LABEL, scoreColor } from "./quizUtils.ts";

/* ------------------------------------------------------------------ hooks */

/**
 * True where the board fits beside the question. That's Mantine's `lg` (75em), not `md`:
 * the app's 264px navbar leaves too little room at `md` for a 280px panel and a comfortable question.
 */
export function useWideBoard(): boolean {
  return useMediaQuery("(min-width: 75em)", false, { getInitialValueInEffect: false }) ?? false;
}

/** "Share my score" for new attempts: on by default, remembered per browser (storage errors fall back to on). */
export function useSharePreference(): [boolean, (value: boolean) => void] {
  const [value, setValue] = useLocalStorage<boolean>({
    key: SHARE_PREFERENCE_KEY,
    defaultValue: true,
    getInitialValueInEffect: false,
    serialize: String,
    deserialize: raw => parseSharePreference(raw),
  });
  return [value, setValue];
}

/** A clock that ticks, so "active now" dots fade without waiting for new data. */
export function useNow(every = 15_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(timer);
  }, [every]);
  return now;
}

/* ------------------------------------------------------------ public parts */

interface BoardProps {
  roomId: string;
  quizId: string;
  /** The attempt being taken, so its switch works before the board catches up. */
  myAttempt?: { id: string; shareScore: boolean };
}

/** Desktop, beside the question: who's studying this quiz and how they're doing. */
export function StudyBoardPanel({ roomId, quizId, myAttempt, listMaxHeight = "55vh" }: BoardProps & { listMaxHeight?: number | string }) {
  const board = useQuizBoard(roomId, quizId);
  const now = useNow();
  // The board is a bonus: if it can't load, the quiz carries on without it.
  if (board.isError) return null;
  const entries = sortBoard(board.data?.board ?? []);
  const { activeNow } = boardSummary(entries, now);

  return (
    <Card padding="md" data-testid="study-board" aria-label="Studying together">
      <Group justify="space-between" gap="xs" wrap="nowrap" mb="sm">
        <Group gap={6} wrap="nowrap">
          <IconUsers size={16} stroke={1.8} aria-hidden="true" />
          <Text fw={600} size="sm">
            Studying together
          </Text>
        </Group>
        {activeNow > 0 && <LiveBadge count={activeNow} />}
      </Group>
      {board.isPending ? (
        <BoardSkeleton />
      ) : (
        <BoardContent roomId={roomId} quizId={quizId} entries={entries} now={now} myAttempt={myAttempt} listMaxHeight={listMaxHeight} />
      )}
    </Card>
  );
}

/** Phones and tablets, above the question: one tappable line that opens the board in a drawer. */
export function StudyBoardStrip({ roomId, quizId, myAttempt }: BoardProps) {
  const board = useQuizBoard(roomId, quizId);
  const now = useNow();
  const [open, setOpen] = useState(false);
  if (board.isError || board.isPending) return null;

  const entries = sortBoard(board.data.board);
  const { studying, activeNow, others } = boardSummary(entries, now);
  const faces = others > 0 ? entries.filter(e => !e.isMe) : entries;
  const shown = faces.slice(0, 3);
  const label = others === 0 ? "Just you so far" : studying > 0 ? `${studying} studying` : `${entries.length} took it`;

  return (
    <>
      <UnstyledButton
        onClick={() => setOpen(true)}
        w="100%"
        mb="md"
        px="sm"
        py={6}
        bdrs="xl"
        bg="var(--mantine-color-default)"
        style={{ border: "1px solid var(--mantine-color-default-border)" }}
        aria-haspopup="dialog"
        aria-label={`Studying together: ${label}. ${others === 0 ? "Invite friends" : "See scores"}`}
        data-testid="board-strip"
      >
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Group gap={8} wrap="nowrap" miw={0}>
            {activeNow > 0 && <LiveDot />}
            {shown.length > 0 && (
              <Avatar.Group spacing={6} style={{ flexShrink: 0 }}>
                {shown.map(e => (
                  <Avatar key={e.attemptId} src={e.avatarUrl} size={24} radius="xl" color="clay" alt="">
                    {initials(e.name)}
                  </Avatar>
                ))}
                {faces.length > shown.length && (
                  <Avatar size={24} radius="xl">
                    +{faces.length - shown.length}
                  </Avatar>
                )}
              </Avatar.Group>
            )}
            <Text size="sm" fw={500} truncate>
              {label}
            </Text>
          </Group>
          <Group gap={4} wrap="nowrap" c="var(--mantine-primary-color-light-color)" style={{ flexShrink: 0 }}>
            <Text size="sm" fw={600} visibleFrom="xs">
              {others === 0 ? "Invite friends" : "See scores"}
            </Text>
            <IconChevronUp size={16} aria-hidden="true" />
          </Group>
        </Group>
      </UnstyledButton>

      <Drawer
        opened={open}
        onClose={() => setOpen(false)}
        position="bottom"
        title={
          <Group gap={8} wrap="nowrap">
            <Text fw={600}>Studying together</Text>
            {activeNow > 0 && <LiveBadge count={activeNow} />}
          </Group>
        }
        radius="lg"
        styles={{ content: { height: "auto", maxHeight: "85dvh", flex: "1 1 100%", width: "100%" }, inner: { alignItems: "flex-end" } }}
      >
        <Box pb="md">
          <BoardContent roomId={roomId} quizId={quizId} entries={entries} now={now} myAttempt={myAttempt} />
        </Box>
      </Drawer>
    </>
  );
}

/** Start screen: who's taking it right now and everyone's best. Your sharing choice for the next attempt sits by the mode cards. */
export function StartBoard({ roomId, quizId }: { roomId: string; quizId: string }) {
  const board = useQuizBoard(roomId, quizId);
  const now = useNow();
  if (board.isError) return null;
  const entries = sortBoard(board.data?.board ?? []);
  const { studying, activeNow } = boardSummary(entries, now);

  return (
    <div data-testid="start-board">
      <Group gap={8} mb="sm" wrap="nowrap">
        <IconUsers size={18} stroke={1.8} aria-hidden="true" />
        <Title order={2}>Studying together</Title>
        {activeNow > 0 ? <LiveBadge count={activeNow} /> : studying > 0 ? <Badge variant="light" color="gray">{studying} in progress</Badge> : null}
      </Group>
      <Card padding="lg">
        {board.isPending ? <BoardSkeleton /> : <BoardContent roomId={roomId} quizId={quizId} entries={entries} now={now} showSwitch={false} showBest />}
      </Card>
    </div>
  );
}

/** Results: where everyone landed, best visible score first. Hidden and unfinished scores stay unranked. */
export function ResultsBoard({ roomId, quizId }: { roomId: string; quizId: string }) {
  const board = useQuizBoard(roomId, quizId);
  const now = useNow();
  if (board.isError) return null;
  const entries = board.data?.board ?? [];
  const ranked = rankBoard(entries);
  const me = entries.find(e => e.isMe);
  const solo = boardSummary(entries, now).others === 0;

  return (
    <Card data-testid="results-board">
      <Group gap={8} mb="md" wrap="nowrap">
        <IconTrophy size={20} stroke={1.8} aria-hidden="true" />
        <Title order={2}>Where everyone landed</Title>
      </Group>
      {board.isPending ? (
        <BoardSkeleton />
      ) : (
        <Stack gap="md">
          {solo ? (
            <InviteHint roomId={roomId} />
          ) : (
            <Stack gap="md" component="ol" p={0} m={0} style={{ listStyle: "none" }} aria-label="Leaderboard">
              {ranked.map(({ entry, rank }) => (
                <li key={entry.attemptId}>
                  <BoardRow entry={entry} now={now} rank={rank} showBest />
                </li>
              ))}
            </Stack>
          )}
          {me && <ShareSwitch roomId={roomId} quizId={quizId} attemptId={me.attemptId} checked={me.shareScore} />}
        </Stack>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- inside */

function BoardContent({
  roomId,
  quizId,
  entries,
  now,
  myAttempt,
  showSwitch = true,
  showBest = false,
  listMaxHeight,
}: {
  roomId: string;
  quizId: string;
  entries: BoardEntry[];
  now: number;
  myAttempt?: { id: string; shareScore: boolean };
  showSwitch?: boolean;
  showBest?: boolean;
  listMaxHeight?: number | string;
}) {
  const me = entries.find(e => e.isMe);
  const switchFor = myAttempt ?? (me ? { id: me.attemptId, shareScore: me.shareScore } : null);
  // Prefer the board's copy of my attempt when it's the same one: it reflects optimistic flips too.
  const checked = me && switchFor && me.attemptId === switchFor.id ? me.shareScore : switchFor?.shareScore ?? true;
  const solo = entries.every(e => e.isMe);

  const list = (
    <Stack gap="md" component="ul" p={0} m={0} style={{ listStyle: "none" }}>
      {entries.map(entry => (
        <li key={entry.attemptId}>
          <BoardRow entry={entry} now={now} showBest={showBest} />
        </li>
      ))}
    </Stack>
  );

  return (
    <Stack gap="md">
      {entries.length > 0 && (listMaxHeight ? <ScrollArea.Autosize mah={listMaxHeight} type="auto" offsetScrollbars>{list}</ScrollArea.Autosize> : list)}
      {solo && <InviteHint roomId={roomId} nobodyYet={entries.length === 0} />}
      {showSwitch && switchFor && <ShareSwitch roomId={roomId} quizId={quizId} attemptId={switchFor.id} checked={checked} />}
    </Stack>
  );
}

const STATUS_ICON: Partial<Record<EntryStatus["kind"], { icon: typeof IconLock; color: string }>> = {
  finished: { icon: IconCircleCheck, color: "var(--mantine-color-teal-6)" },
  "finished-hidden": { icon: IconLock, color: "var(--mantine-color-dimmed)" },
  hidden: { icon: IconLock, color: "var(--mantine-color-dimmed)" },
  exam: { icon: IconHourglassHigh, color: "var(--mantine-color-grape-6)" },
};

function BoardRow({ entry, now, rank, showBest = false }: { entry: BoardEntry; now: number; rank?: number | null; showBest?: boolean }) {
  const status = entryStatus(entry);
  const active = !entry.completedAt && isActiveRecently(entry, now);
  const name = entry.isMe ? "You" : entry.name;
  const done = entry.total ? Math.min(100, (100 * entry.answered) / entry.total) : 0;
  const score = status.kind === "progress" || status.kind === "finished" ? status.score : null;
  const marker = STATUS_ICON[status.kind];
  const Icon = marker?.icon;

  const details = [statusLabel(status)];
  if (!entry.completedAt && status.kind !== "starting") details.push(`${entry.answered} of ${entry.total} done`);
  if (showBest && entry.bestScore !== null && entry.bestScore !== score) details.push(`best ${entry.bestScore}%`);
  const detail = details.join(" · ");

  return (
    <Group gap="sm" wrap="nowrap" align="flex-start" data-testid="board-row" data-me={entry.isMe || undefined} data-status={status.kind}>
      {rank !== undefined && (
        <Text size="sm" fw={700} w={22} ta="center" mt={6} c={rank === 1 ? "var(--mantine-color-yellow-7)" : "dimmed"} style={{ flexShrink: 0 }} aria-label={rank ? `Rank ${rank}` : "Not ranked"}>
          {rank ?? "–"}
        </Text>
      )}
      <Indicator color="teal" size={10} offset={4} position="bottom-end" withBorder disabled={!active} processing style={{ flexShrink: 0 }}>
        <UserAvatar name={entry.name} url={entry.avatarUrl} size={32} />
      </Indicator>
      <Stack gap={4} miw={0} flex={1}>
        <Group gap={6} wrap="nowrap" justify="space-between">
          <Group gap={6} wrap="nowrap" miw={0}>
            <Text size="sm" fw={600} truncate>
              {name}
            </Text>
            {entry.isMe && !entry.shareScore && (
              <Tooltip label="Your score is hidden from others" withArrow>
                <Box component="span" c="dimmed" display="inline-flex" style={{ flexShrink: 0 }} aria-label="Your score is hidden from others" role="img">
                  <IconLock size={13} aria-hidden="true" />
                </Box>
              </Tooltip>
            )}
            <Badge size="xs" variant="light" color={entry.mode === "exam" ? "grape" : "clay"} style={{ flexShrink: 0 }}>
              {MODE_LABEL[entry.mode]}
            </Badge>
          </Group>
          {score !== null && (
            <Text size="sm" fw={700} c={`var(--mantine-color-${scoreColor(score)}-light-color)`} style={{ flexShrink: 0 }} data-testid="board-score">
              {score}%
            </Text>
          )}
        </Group>
        <Progress
          value={done}
          size="xs"
          radius="xl"
          color={entry.completedAt ? "teal" : entry.mode === "exam" ? "grape" : undefined}
          transitionDuration={300}
          aria-label={`${name}: ${entry.answered} of ${entry.total} answered`}
        />
        <Group gap={4} wrap="nowrap" align="flex-start">
          {Icon && <Icon size={14} color={marker.color} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />}
          <Text size="xs" c="dimmed" lineClamp={2}>
            {detail}
            {active && <VisuallyHidden component="span"> · active now</VisuallyHidden>}
          </Text>
        </Group>
      </Stack>
    </Group>
  );
}

function ShareSwitch({ roomId, quizId, attemptId, checked }: { roomId: string; quizId: string; attemptId: string; checked: boolean }) {
  const sharing = useSetAttemptSharing(roomId, quizId);
  const [, setPreference] = useSharePreference();
  return (
    <Switch
      checked={checked}
      onChange={event => {
        const shareScore = event.currentTarget.checked;
        setPreference(shareScore); // your next attempt starts the same way
        sharing.mutate({ attemptId, shareScore }, { onError: error => notify(error.message, "error") });
      }}
      label="Share my score"
      description="Others see your progress either way."
      data-testid="share-score"
      styles={{ body: { alignItems: "flex-start" } }}
    />
  );
}

function InviteHint({ roomId, nobodyYet = false }: { roomId: string; nobodyYet?: boolean }) {
  return (
    <Group gap="sm" wrap="nowrap" align="flex-start" data-testid="board-empty">
      <ThemeIcon variant="light" radius="xl" size={32} style={{ flexShrink: 0 }}>
        <IconUsers size={16} stroke={1.8} />
      </ThemeIcon>
      <Text size="sm" c="dimmed">
        {nobodyYet && "No one's taken this quiz yet. "}
        <Anchor component={Link} to={`/rooms/${roomId}?tab=members`} size="sm" fw={600}>
          Invite friends
        </Anchor>{" "}
        to this room to study this quiz together.
      </Text>
    </Group>
  );
}

function LiveDot() {
  return (
    <span
      aria-hidden="true"
      style={{ width: 8, height: 8, flexShrink: 0, borderRadius: "50%", background: "var(--mantine-color-teal-6)", boxShadow: "0 0 0 3px var(--mantine-color-teal-light)" }}
    />
  );
}

function LiveBadge({ count }: { count: number }) {
  return (
    <Badge variant="light" color="teal" size="sm" leftSection={<LiveDot />} style={{ flexShrink: 0 }}>
      {count} live
    </Badge>
  );
}

function BoardSkeleton() {
  return (
    <Stack gap="md" aria-busy="true" aria-label="Loading who's studying">
      {[0, 1].map(i => (
        <Group key={i} gap="sm" wrap="nowrap">
          <Skeleton circle h={32} w={32} />
          <Stack gap={6} flex={1}>
            <Skeleton h={10} w="60%" radius="xl" />
            <Skeleton h={6} radius="xl" />
          </Stack>
        </Group>
      ))}
    </Stack>
  );
}
