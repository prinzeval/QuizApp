import { lazy, Suspense } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  EmptyState,
  Grid,
  Group,
  NavLink,
  Progress as ProgressBar,
  RingProgress,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconAlertCircle, IconArrowRight, IconChecklist, IconCircleCheck, IconListCheck, IconTarget, IconTrophy } from "@tabler/icons-react";
import type { Room } from "../../lib/api.ts";
import type { Progress } from "../../lib/learningApi.ts";
import { formatDate, plural } from "../../lib/format.ts";
import { useProgress } from "../../hooks/learning.ts";
import { Scribble } from "../../components/Doodles.tsx";
import { accuracyColor, fillTrend } from "./progressUtils.ts";

// Recharts is heavy; load it only when the progress tab has something to plot.
const TrendChart = lazy(() => import("./TrendChart.tsx"));

export function ProgressTab({ room }: { room: Room }) {
  const query = useProgress(room.id);
  const [, setSearchParams] = useSearchParams();
  const goToQuizzes = (focus?: string) => setSearchParams(focus ? { tab: "quizzes", focus } : { tab: "quizzes" });

  if (query.isPending) return <ProgressSkeleton />;

  if (query.isError) {
    return (
      <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title="Couldn't load your progress" role="alert">
        <Stack gap="sm" align="flex-start">
          <Text size="sm">{query.error.message}</Text>
          <Button size="xs" variant="default" onClick={() => query.refetch()} loading={query.isRefetching}>
            Try again
          </Button>
        </Stack>
      </Alert>
    );
  }

  const progress = query.data;

  if (progress.totals.answered === 0) {
    return (
      <EmptyState
        py={56}
        px="md"
        bd="1px dashed var(--mantine-color-default-border)"
        bdrs="lg"
        variant="light"
        icon={<IconChecklist size={24} />}
        title={
          <>
            Your progress <Scribble>starts here</Scribble>
          </>
        }
        description="Take a quiz in this room and you'll see your accuracy, strongest and weakest topics, and how you improve week by week."
      >
        <EmptyState.Actions>
          <Button onClick={() => goToQuizzes()} rightSection={<IconArrowRight size={16} />}>
            Go to Quizzes
          </Button>
        </EmptyState.Actions>
      </EmptyState>
    );
  }

  return (
    <Stack gap="lg">
      <Stats totals={progress.totals} />
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <TrendCard trend={progress.trend} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <WeakTopicsCard progress={progress} onPractice={goToQuizzes} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <TopicsCard topics={progress.topics} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <RecentAttemptsCard roomId={room.id} attempts={progress.recentAttempts} />
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

/* ------------------------------------------------------------------ stats */

function StatCard({ label, short, value, hint, icon }: { label: string; short: string; value: string; hint?: string; icon: React.ReactNode }) {
  return (
    <Card padding="md" h="100%" px={{ base: "sm", sm: "md" }}>
      <Stack gap={6} justify="space-between" h="100%">
        <Group justify="space-between" wrap="nowrap" gap="xs" align="flex-start">
          <Text size="sm" c="dimmed" fw={500} visibleFrom="sm">
            {label}
          </Text>
          <Text size="xs" c="dimmed" fw={500} hiddenFrom="sm">
            {short}
          </Text>
          <ThemeIcon variant="light" color="gray" size={28} radius="md" aria-hidden="true" visibleFrom="sm">
            {icon}
          </ThemeIcon>
        </Group>
        <Box>
          <Text fz={{ base: 24, sm: 30 }} fw={600} lh={1.1} ff="heading" style={{ fontVariantNumeric: "tabular-nums" }}>
            {value}
          </Text>
          {hint && (
            <Text size="xs" c="dimmed" mt={2} visibleFrom="sm">
              {hint}
            </Text>
          )}
        </Box>
      </Stack>
    </Card>
  );
}

function Stats({ totals }: { totals: Progress["totals"] }) {
  const color = accuracyColor(totals.accuracy);
  return (
    <Grid gap={{ base: "sm", sm: "md" }}>
      <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
        <Card padding="md" h="100%" data-testid="progress-accuracy">
          <Group gap="sm" wrap="nowrap" h="100%">
            <RingProgress
              size={72}
              thickness={7}
              roundCaps
              sections={[{ value: totals.accuracy, color }]}
              rootColor="var(--mantine-color-default-border)"
              aria-label={`Overall accuracy ${totals.accuracy}%`}
              label={
                <Text ta="center" fw={700} size="sm" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {totals.accuracy}%
                </Text>
              }
            />
            <Stack gap={0} miw={0}>
              <Text size="sm" c="dimmed" fw={500}>
                Accuracy
              </Text>
              <Text size="xs" c="dimmed">
                {totals.correct} of {totals.answered} right
              </Text>
            </Stack>
          </Group>
        </Card>
      </Grid.Col>
      <Grid.Col span={{ base: 4, sm: 6, md: 3 }}>
        <StatCard label="Questions answered" short="Answered" value={totals.answered.toLocaleString()} icon={<IconListCheck size={16} />} />
      </Grid.Col>
      <Grid.Col span={{ base: 4, sm: 6, md: 3 }}>
        <StatCard
          label="Quizzes completed"
          short="Completed"
          value={totals.completedAttempts.toLocaleString()}
          hint="Finished attempts"
          icon={<IconTrophy size={16} />}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 4, sm: 6, md: 3 }}>
        <StatCard
          label="Quizzes tried"
          short="Quizzes tried"
          value={totals.quizzesTried.toLocaleString()}
          hint="Different quizzes"
          icon={<IconChecklist size={16} />}
        />
      </Grid.Col>
    </Grid>
  );
}

/* ------------------------------------------------------------------ cards */

function SectionTitle({ children, description }: { children: React.ReactNode; description?: string }) {
  return (
    <Stack gap={2} mb="md">
      <Title order={2} fz="h3">
        {children}
      </Title>
      {description && (
        <Text size="sm" c="dimmed">
          {description}
        </Text>
      )}
    </Stack>
  );
}

function TrendCard({ trend }: { trend: Progress["trend"] }) {
  const points = fillTrend(trend);
  const active = points.filter(point => point.accuracy !== null);
  const latest = active[active.length - 1];
  const previous = active[active.length - 2];
  const delta = latest && previous ? latest.accuracy! - previous.accuracy! : null;

  return (
    <Card h="100%">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <SectionTitle description="Accuracy per week, last 8 weeks">Weekly trend</SectionTitle>
        {delta !== null && (
          <Badge variant="light" color={delta > 0 ? "green" : delta < 0 ? "red" : "gray"} style={{ flexShrink: 0 }}>
            {delta > 0 ? "+" : ""}
            {delta} pts
          </Badge>
        )}
      </Group>
      <Suspense fallback={<Skeleton h={220} radius="md" />}>
        <TrendChart points={points} />
      </Suspense>
      <Text size="xs" c="dimmed" mt="xs">
        {active.length <= 1
          ? "Keep practising: your trend line appears after a second week of quizzes."
          : `${plural(active.length, "week")} with answers.`}
      </Text>
    </Card>
  );
}

function WeakTopicsCard({ progress, onPractice }: { progress: Progress; onPractice: (topic: string) => void }) {
  const byTopic = new Map(progress.topics.map(topic => [topic.topic, topic]));
  return (
    <Card h="100%">
      <SectionTitle description="Topics under 70% after at least 3 answers">Needs work</SectionTitle>
      {progress.weakTopics.length === 0 ? (
        <Center flex={1} py="md">
          <Stack align="center" gap={6}>
            <ThemeIcon variant="light" color="green" size={40} radius="xl" aria-hidden="true">
              <IconCircleCheck size={22} />
            </ThemeIcon>
            <Text fw={500}>No weak spots right now</Text>
            <Text size="sm" c="dimmed" ta="center" maw={300}>
              Every topic you've practised enough is at 70% or better.
            </Text>
          </Stack>
        </Center>
      ) : (
        <Stack gap="xs">
          {progress.weakTopics.map(topic => {
            const stats = byTopic.get(topic);
            return (
              <Group
                key={topic}
                justify="space-between"
                wrap="nowrap"
                gap="sm"
                p="sm"
                bdrs="md"
                bg="var(--mantine-color-default-hover)"
                data-testid="weak-topic"
              >
                <Group gap="sm" wrap="nowrap" miw={0}>
                  <ThemeIcon variant="light" color={stats ? accuracyColor(stats.accuracy) : "red"} size={32} radius="md" aria-hidden="true">
                    <IconTarget size={18} />
                  </ThemeIcon>
                  <Stack gap={0} miw={0}>
                    <Text size="sm" fw={600} lineClamp={2} style={{ overflowWrap: "anywhere" }}>
                      {topic}
                    </Text>
                    {stats && (
                      <Text size="xs" c="dimmed">
                        {stats.accuracy}% · {stats.correct}/{stats.answered} right
                      </Text>
                    )}
                  </Stack>
                </Group>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => onPractice(topic)}
                  data-testid="practice-topic"
                  aria-label={`Practice ${topic}`}
                  style={{ flexShrink: 0 }}
                >
                  Practice this
                </Button>
              </Group>
            );
          })}
        </Stack>
      )}
    </Card>
  );
}

function TopicsCard({ topics }: { topics: Progress["topics"] }) {
  return (
    <Card h="100%">
      <SectionTitle description="Weakest first">By topic</SectionTitle>
      <Stack gap="md" component="ul" m={0} p={0} style={{ listStyle: "none" }}>
        {topics.map(topic => {
          const color = accuracyColor(topic.accuracy);
          return (
            <Box component="li" key={topic.topic} data-testid="progress-topic">
              <Group justify="space-between" wrap="nowrap" gap="sm" mb={6}>
                <Text size="sm" fw={500} truncate miw={0}>
                  {topic.topic}
                </Text>
                <Group gap={8} wrap="nowrap" style={{ flexShrink: 0 }}>
                  <Text size="xs" c="dimmed">
                    {topic.correct}/{topic.answered}
                  </Text>
                  <Text size="sm" fw={600} w={40} ta="right" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {topic.accuracy}%
                  </Text>
                </Group>
              </Group>
              <ProgressBar value={topic.accuracy} color={color} size="md" radius="xl" aria-label={`${topic.topic}: ${topic.accuracy}% correct`} />
            </Box>
          );
        })}
      </Stack>
    </Card>
  );
}

function RecentAttemptsCard({ roomId, attempts }: { roomId: string; attempts: Progress["recentAttempts"] }) {
  return (
    <Card h="100%">
      <SectionTitle description="Your latest finished quizzes">Recent attempts</SectionTitle>
      {attempts.length === 0 ? (
        <Text size="sm" c="dimmed">
          Finish a quiz to see it here.
        </Text>
      ) : (
        <Stack gap={2} mx={-8}>
          {attempts.map(attempt => {
            const score = attempt.totalCount ? Math.round((attempt.correctCount / attempt.totalCount) * 100) : 0;
            return (
              <NavLink
                key={attempt.id}
                component={Link}
                to={`/rooms/${roomId}/quizzes/${attempt.quizId}?attempt=${attempt.id}`}
                label={attempt.quizTitle}
                description={`${attempt.mode === "exam" ? "Exam" : "Practice"} · ${formatDate(attempt.completedAt)}`}
                rightSection={
                  <Badge variant="light" color={accuracyColor(score)} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {attempt.correctCount}/{attempt.totalCount}
                  </Badge>
                }
                styles={{ root: { borderRadius: "var(--mantine-radius-md)" }, label: { fontWeight: 500 } }}
                data-testid="recent-attempt"
              />
            );
          })}
        </Stack>
      )}
    </Card>
  );
}

function ProgressSkeleton() {
  return (
    <Stack gap="lg" aria-label="Loading progress" role="status">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={{ base: "sm", sm: "md" }}>
        {[0, 1, 2, 3].map(i => (
          <Skeleton key={i} h={104} radius="lg" />
        ))}
      </SimpleGrid>
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Skeleton h={320} radius="lg" />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Skeleton h={320} radius="lg" />
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
