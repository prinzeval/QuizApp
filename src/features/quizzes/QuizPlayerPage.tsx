import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Box, Button, Card, Center, EmptyState, Group, Loader, Stack, Text, ThemeIcon, Title, VisuallyHidden } from "@mantine/core";
import { IconAlertTriangle, IconArrowLeft, IconRefresh, IconSparkles } from "@tabler/icons-react";
import { useAuth } from "../../auth/AuthContext.tsx";
import { queryKeys } from "../../hooks/queryKeys.ts";
import { useAttempt, useCompleteAttempt, useQuiz, useRetryQuiz, useStartAttempt } from "../../hooks/learning.ts";
import { useRoom } from "../../hooks/rooms.ts";
import { useRoomLive } from "../../realtime/useRoomLive.ts";
import { ApiError } from "../../lib/api.ts";
import type { QuizMode, QuizQuestion, QuizSummary } from "../../lib/learningApi.ts";
import { plural } from "../../lib/format.ts";
import { notify } from "../../notify.ts";
import { ExamRunner } from "./ExamRunner.tsx";
import { PracticeRunner } from "./PracticeRunner.tsx";
import { Results } from "./Results.tsx";
import { StartScreen } from "./StartScreen.tsx";
import type { AttemptData } from "./playerParts.tsx";
import { isReview } from "./quizUtils.ts";

/** /rooms/:roomId/quizzes/:quizId — start screen, taking the quiz (?attempt=<id>) and results. */
export function QuizPlayerPage() {
  const { roomId = "", quizId = "" } = useParams();
  // Keep quiz status live here too (generating → ready), and follow room deletion.
  useRoomLive(roomId);
  const room = useRoom(roomId);
  const quiz = useQuiz(roomId, quizId);
  const [searchParams, setSearchParams] = useSearchParams();
  const attemptId = searchParams.get("attempt");
  const queryClient = useQueryClient();
  const startAttempt = useStartAttempt(roomId, quizId);
  const [starting, setStarting] = useState<QuizMode | null>(null);

  const status = quiz.data?.quiz.status;

  // Belt and braces: if the live connection drops, still notice when generation finishes.
  useEffect(() => {
    if (status !== "generating") return;
    const timer = setInterval(() => queryClient.invalidateQueries({ queryKey: queryKeys.quiz(roomId, quizId), exact: true }), 5000);
    return () => clearInterval(timer);
  }, [status, queryClient, roomId, quizId]);

  const start = (mode: QuizMode) => {
    if (starting) return;
    setStarting(mode);
    startAttempt.mutate(mode, {
      onSuccess: ({ attempt }) => {
        // Seed the new attempt so the first question shows instantly.
        const questions = quiz.data?.questions ?? [];
        queryClient.setQueryData<AttemptData>(queryKeys.attempt(roomId, quizId, attempt.id), {
          attempt,
          questions: questions.map(q => ({ id: q.id, position: q.position, response: null })),
        });
        setSearchParams({ attempt: attempt.id });
      },
      onError: error => notify(error.message, "error"),
      onSettled: () => setStarting(null),
    });
  };

  const openAttempt = (id: string) => setSearchParams({ attempt: id });

  const quizzesHref = `/rooms/${roomId}?tab=quizzes`;
  const title = quiz.data?.quiz.title;

  let body;
  if (quiz.isPending) {
    body = <PageLoader label="Loading quiz…" />;
  } else if (quiz.isError) {
    const notFound = quiz.error instanceof ApiError && (quiz.error.status === 404 || quiz.error.status === 403);
    body = (
      <EmptyState
        title={notFound ? "Quiz not found" : "Couldn't load this quiz"}
        description={notFound ? "It may have been deleted." : quiz.error.message}
        py={56}
        bd="1px dashed var(--mantine-color-default-border)"
        bdrs="lg"
      >
        <EmptyState.Actions>
          {!notFound && (
            <Button variant="default" onClick={() => quiz.refetch()}>
              Try again
            </Button>
          )}
          <Button component={Link} to={quizzesHref} variant={notFound ? "default" : "subtle"}>
            Back to quizzes
          </Button>
        </EmptyState.Actions>
      </EmptyState>
    );
  } else if (quiz.data.quiz.status !== "ready") {
    body = <NotReady quiz={quiz.data.quiz} canManage={room.data?.room.role === "owner"} />;
  } else if (quiz.data.questions.length === 0) {
    body = <EmptyState title="This quiz has no questions" py={56} bd="1px dashed var(--mantine-color-default-border)" bdrs="lg" />;
  } else if (attemptId) {
    body = (
      <AttemptView
        key={attemptId}
        roomId={roomId}
        quiz={quiz.data.quiz}
        questions={[...quiz.data.questions].sort((a, b) => a.position - b.position)}
        attemptId={attemptId}
        starting={starting}
        onStart={start}
        onBack={() => setSearchParams({})}
      />
    );
  } else {
    body = (
      <Box maw={760}>
        <StartScreen
          quiz={quiz.data.quiz}
          questions={quiz.data.questions}
          attempts={quiz.data.attempts}
          starting={starting}
          startError={startAttempt.isError ? startAttempt.error.message : null}
          onStart={start}
          onOpenAttempt={openAttempt}
        />
      </Box>
    );
  }

  return (
    <>
      <Group component="nav" aria-label="Breadcrumb" gap={2} mb="lg" ml={-8} wrap="nowrap" miw={0}>
        <Button component={Link} to={quizzesHref} variant="subtle" color="gray" c="dimmed" fw={500} size="sm" px={8} leftSection={<IconArrowLeft size={14} aria-hidden="true" />} style={{ flexShrink: 0 }}>
          <Text span inherit visibleFrom="xs">
            {room.data?.room.name ? `${room.data.room.name} · Quizzes` : "Quizzes"}
          </Text>
          <Text span inherit hiddenFrom="xs">
            Quizzes
          </Text>
        </Button>
        {title && attemptId && (
          <>
            <Text c="dimmed" size="sm" aria-hidden="true">
              /
            </Text>
            <Button component={Link} to={`/rooms/${roomId}/quizzes/${quizId}`} variant="subtle" color="gray" c="dimmed" fw={500} size="sm" px={8} miw={0} styles={{ label: { overflow: "hidden", textOverflow: "ellipsis" } }}>
              {title}
            </Button>
          </>
        )}
      </Group>
      {body}
    </>
  );
}

function PageLoader({ label }: { label: string }) {
  return (
    <Center py={96} role="status">
      <Loader aria-hidden="true" />
      <VisuallyHidden>{label}</VisuallyHidden>
    </Center>
  );
}

function NotReady({ quiz, canManage: isOwner }: { quiz: QuizSummary; canManage: boolean }) {
  const { user } = useAuth();
  const retry = useRetryQuiz(quiz.roomId);
  const canManage = isOwner || (!!user && quiz.createdBy === user.id);
  const generating = quiz.status === "generating";

  return (
    <Card padding="xl" maw={560} mx="auto" mt="xl" data-testid="quiz-not-ready">
      <Stack align="center" ta="center" gap="md">
        {generating ? (
          <ThemeIcon size={56} radius="xl" variant="light">
            <IconSparkles size={28} stroke={1.6} />
          </ThemeIcon>
        ) : (
          <ThemeIcon size={56} radius="xl" variant="light" color="red">
            <IconAlertTriangle size={28} stroke={1.6} />
          </ThemeIcon>
        )}
        <div role="status" aria-live="polite">
          <Title order={1} fz="1.5rem">
            {generating ? "Writing your quiz…" : "This quiz couldn't be written"}
          </Title>
          <Text c="dimmed" mt="xs">
            {generating
              ? `Reading your notes and drafting ${plural(quiz.requestedCount, "question")}. This page will update by itself.`
              : quiz.error || "Something went wrong while generating it."}
          </Text>
        </div>
        {generating ? (
          <Loader type="dots" />
        ) : (
          <Group justify="center" gap="sm">
            {canManage && (
              <Button
                leftSection={<IconRefresh size={16} />}
                loading={retry.isPending}
                onClick={() => retry.mutate(quiz.id, { onError: error => notify(error.message, "error") })}
                data-testid="retry-quiz"
              >
                Try again
              </Button>
            )}
            <Button component={Link} to={`/rooms/${quiz.roomId}?tab=quizzes`} variant="default">
              Back to quizzes
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  );
}

interface AttemptViewProps {
  roomId: string;
  quiz: QuizSummary;
  questions: QuizQuestion[];
  attemptId: string;
  starting: QuizMode | null;
  onStart: (mode: QuizMode) => void;
  onBack: () => void;
}

function AttemptView({ roomId, quiz, questions, attemptId, starting, onStart, onBack }: AttemptViewProps) {
  const attempt = useAttempt(roomId, quiz.id, attemptId);
  const complete = useCompleteAttempt(roomId, quiz.id, attemptId);
  const queryClient = useQueryClient();

  const finish = () => {
    if (complete.isPending) return;
    complete.mutate(undefined, {
      onSuccess: result => queryClient.setQueryData<AttemptData>(queryKeys.attempt(roomId, quiz.id, attemptId), result),
    });
  };

  if (attempt.isPending) return <PageLoader label="Loading your attempt…" />;

  if (attempt.isError) {
    const notFound = attempt.error instanceof ApiError && attempt.error.status >= 400 && attempt.error.status < 500;
    return (
      <EmptyState
        title={notFound ? "Attempt not found" : "Couldn't load your attempt"}
        description={notFound ? "It may belong to someone else or have been removed." : attempt.error.message}
        py={56}
        bd="1px dashed var(--mantine-color-default-border)"
        bdrs="lg"
      >
        <EmptyState.Actions>
          {!notFound && (
            <Button variant="default" onClick={() => attempt.refetch()}>
              Try again
            </Button>
          )}
          <Button variant={notFound ? "default" : "subtle"} onClick={onBack}>
            Back to quiz
          </Button>
        </EmptyState.Actions>
      </EmptyState>
    );
  }

  const data = attempt.data;
  const finishError = complete.isError ? complete.error.message : null;

  if (data.attempt.completedAt) {
    return (
      <Box maw={760}>
        <Results roomId={roomId} attempt={data.attempt} reviews={data.questions.filter(isReview)} starting={starting} onStart={onStart} />
      </Box>
    );
  }

  const Runner = data.attempt.mode === "exam" ? ExamRunner : PracticeRunner;
  return (
    <Box maw={data.attempt.mode === "exam" ? 1040 : 720}>
      <Runner roomId={roomId} quiz={quiz} questions={questions} data={data} finishing={complete.isPending} finishError={finishError} onFinish={finish} />
    </Box>
  );
}
