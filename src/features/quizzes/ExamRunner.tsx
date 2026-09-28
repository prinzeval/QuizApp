import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert, Box, Button, Card, Drawer, Grid, Group, Kbd, SimpleGrid, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconAlertCircle, IconArrowLeft, IconArrowRight, IconCloudCheck, IconCloudOff, IconLayoutGrid, IconLoader2 } from "@tabler/icons-react";
import { useAnswer } from "../../hooks/learning.ts";
import { useIsMobile } from "../../hooks/useIsMobile.ts";
import type { QuizQuestion, QuizSummary } from "../../lib/learningApi.ts";
import { QuestionView } from "./QuestionView.tsx";
import { FinishConfirm, RunnerHeader, focusOption, isActivatable, usePatchAttempt, useQuizKeys, type AttemptData } from "./playerParts.tsx";
import { keyToOption } from "./quizUtils.ts";
import { isPictureAnswerComplete } from "./PictureQuestion.tsx";

interface ExamRunnerProps {
  roomId: string;
  quiz: QuizSummary;
  questions: QuizQuestion[];
  data: AttemptData;
  finishing: boolean;
  finishError: string | null;
  onFinish: () => void;
}

type SaveState = "idle" | "saving" | "saved" | "error";
const TYPE_DEBOUNCE_MS = 700;

/**
 * Exam: answers are saved as you go (and can be changed) but nothing is
 * revealed until you finish. A navigator jumps between questions.
 */
export function ExamRunner({ roomId, quiz, questions, data, finishing, finishError, onFinish }: ExamRunnerProps) {
  const attemptId = data.attempt.id;
  const answer = useAnswer(roomId, quiz.id, attemptId);
  const patchAttempt = usePatchAttempt(roomId, quiz.id, attemptId);
  const mobile = useIsMobile();

  const [responses, setResponses] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.questions.filter(q => q.response !== null).map(q => [q.id, q.response ?? ""])),
  );
  const [index, setIndex] = useState(() => Math.max(0, questions.findIndex(q => !responses[q.id])));
  const [navOpen, setNavOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [failed, setFailed] = useState<Record<string, string>>({});

  const question = questions[index];
  const value = responses[question.id] ?? "";
  const spotsOf = (id: string) => questions.find(q => q.id === id)?.figure?.zones?.length ?? 0;
  const typeOf = (id: string) => questions.find(q => q.id === id)?.type ?? "";
  // A half-labelled picture isn't an answer yet.
  const isAnswered = (id: string) => isPictureAnswerComplete(typeOf(id), responses[id] ?? "", spotsOf(id));
  const answeredCount = questions.filter(q => isAnswered(q.id)).length;
  const isLast = index === questions.length - 1;

  /* ---- autosave: one request at a time, newest value per question wins ---- */
  const queue = useRef(new Map<string, string>());
  const saved = useRef(new Map<string, string>(Object.entries(responses)));
  const running = useRef<Promise<void> | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const failedRef = useRef(new Map<string, string>());
  const mutateRef = useRef(answer.mutateAsync);
  mutateRef.current = answer.mutateAsync;

  const drain = useCallback(async () => {
    let hadError = false;
    while (queue.current.size) {
      const [questionId, response] = queue.current.entries().next().value as [string, string];
      queue.current.delete(questionId);
      if (saved.current.get(questionId) === response) continue;
      try {
        await mutateRef.current({ questionId, response });
        saved.current.set(questionId, response);
        failedRef.current.delete(questionId);
        patchAttempt({ id: questionId, position: questions.find(q => q.id === questionId)?.position ?? 0, response: response || null });
        setFailed(f => {
          if (!(questionId in f)) return f;
          const { [questionId]: _, ...rest } = f;
          return rest;
        });
      } catch {
        hadError = true;
        failedRef.current.set(questionId, response);
        setFailed(f => ({ ...f, [questionId]: response }));
      }
    }
    setSaveState(hadError ? "error" : "saved");
  }, [patchAttempt, questions]);

  const startDrain = useCallback(() => {
    if (running.current) return running.current;
    setSaveState("saving");
    running.current = drain().finally(() => {
      running.current = null;
      if (queue.current.size) void startDrain();
    });
    return running.current;
  }, [drain]);

  const save = useCallback(
    (questionId: string, response: string) => {
      const trimmed = response.trim();
      // An emptied box clears a saved answer on the server; if nothing was saved, there's nothing to do.
      if (!trimmed && !saved.current.get(questionId)) return;
      clearTimeout(timers.current.get(questionId));
      timers.current.delete(questionId);
      queue.current.set(questionId, trimmed);
      void startDrain();
    },
    [startDrain],
  );

  /** Send anything still waiting on a typing pause, then wait for all saves. */
  const flush = async () => {
    for (const [questionId, timer] of timers.current) {
      clearTimeout(timer);
      queue.current.set(questionId, (responses[questionId] ?? "").trim());
    }
    timers.current.clear();
    for (const [questionId, response] of queue.current) if (!response && !saved.current.get(questionId)) queue.current.delete(questionId);
    if (queue.current.size) void startDrain();
    while (running.current) await running.current;
  };

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const retryFailed = () => {
    Object.entries(failed).forEach(([questionId, response]) => save(questionId, response));
  };

  const choose = (next: string) => {
    setResponses(r => ({ ...r, [question.id]: next }));
    if (question.type === "fill_blank") {
      clearTimeout(timers.current.get(question.id));
      const id = question.id;
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          save(id, next);
        }, TYPE_DEBOUNCE_MS),
      );
    } else if (question.type === "label_image") {
      // Saved once every label is placed; until then any earlier answer is cleared.
      save(question.id, isPictureAnswerComplete("label_image", next, question.figure?.zones?.length ?? 0) ? next : "");
    } else {
      save(question.id, next);
    }
  };

  const commitTyped = () => {
    if (question.type === "fill_blank" && timers.current.has(question.id)) save(question.id, value);
  };

  const go = (to: number) => {
    if (to < 0 || to >= questions.length) return;
    commitTyped();
    setIndex(to);
    setNavOpen(false);
  };

  const finish = async () => {
    await flush();
    if (failedRef.current.size) {
      setConfirming(false);
      return;
    }
    const unanswered = questions.length - questions.filter(q => isAnswered(q.id)).length;
    if (unanswered > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    onFinish();
  };

  /* ---- focus + keyboard ---- */
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  useLayoutEffect(() => {
    if (!firstRender.current) topRef.current?.scrollIntoView({ block: "nearest" });
    firstRender.current = false;
    if (question.type === "fill_blank" && !mobile) inputRef.current?.focus();
    else headingRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useQuizKeys(event => {
    const target = event.target as HTMLElement;
    const onRadio = target.getAttribute("role") === "radio";
    if (event.key === "Enter") {
      if (isActivatable(event) || (onRadio && target.getAttribute("aria-checked") !== "true")) return;
      event.preventDefault();
      if (isLast) void finish();
      else go(index + 1);
      return;
    }
    if (!onRadio && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
      event.preventDefault();
      go(index + (event.key === "ArrowRight" ? 1 : -1));
      return;
    }
    const option = keyToOption(event.key, question.type, question.options?.length ?? 0);
    if (option !== null) {
      event.preventDefault();
      choose(String(option));
      focusOption(option);
    }
  }, !confirming && !navOpen);

  const navigator = (
    <Navigator questions={questions} index={index} isAnswered={isAnswered} onJump={go} />
  );

  const saveIndicator = <SaveIndicator state={saveState} failed={Object.keys(failed).length} onRetry={retryFailed} />;

  return (
    <Box ref={topRef} style={{ scrollMarginTop: 24 }}>
      <Grid gap={{ base: "md", md: 40 }}>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <RunnerHeader
            title={quiz.title}
            mode="exam"
            index={index}
            total={questions.length}
            done={answeredCount}
            right={
              mobile ? (
                <Button
                  variant="default"
                  size="sm"
                  leftSection={<IconLayoutGrid size={16} />}
                  onClick={() => setNavOpen(true)}
                  aria-label={`All questions, ${answeredCount} of ${questions.length} answered`}
                  data-testid="open-navigator"
                >
                  {answeredCount}/{questions.length}
                </Button>
              ) : (
                saveIndicator
              )
            }
          />

          <Stack gap="xl">
            <QuestionView
              roomId={roomId}
              key={question.id}
              question={question}
              value={value}
              onChange={choose}
              onSubmit={() => {
                commitTyped();
                if (isLast) void finish();
                else go(index + 1);
              }}
              headingRef={headingRef}
              inputRef={inputRef}
            />

            {finishError && (
              <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert" title="Couldn't finish the exam">
                <Text size="sm">{finishError}</Text>
                <Button size="xs" variant="light" color="red" mt="xs" onClick={onFinish} loading={finishing}>
                  Try again
                </Button>
              </Alert>
            )}

            {mobile && saveIndicator}

            <Group justify="space-between" gap="sm" wrap="nowrap">
              <Button
                variant="default"
                size="md"
                leftSection={<IconArrowLeft size={18} />}
                onClick={() => go(index - 1)}
                disabled={index === 0}
                data-testid="prev-question"
              >
                {mobile ? "Back" : "Previous"}
              </Button>
              <Text size="xs" c="dimmed" visibleFrom="sm" ta="center">
                <Kbd size="xs">←</Kbd> <Kbd size="xs">→</Kbd> to move
                {(question.type === "multiple_choice" || question.type === "true_false") && (
                  <>
                    {" "}· <Kbd size="xs">{question.type === "true_false" ? "T" : "1"}</Kbd>–
                    <Kbd size="xs">{question.type === "true_false" ? "F" : "4"}</Kbd> to choose
                  </>
                )}
              </Text>
              {isLast ? (
                <Button size="md" onClick={() => void finish()} loading={finishing} data-testid="finish-quiz">
                  Finish
                </Button>
              ) : (
                <Button size="md" rightSection={<IconArrowRight size={18} />} onClick={() => go(index + 1)} data-testid="next-question">
                  Next
                </Button>
              )}
            </Group>
          </Stack>
        </Grid.Col>

        {!mobile && (
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card padding="lg" style={{ position: "sticky", top: 24 }}>
              <Stack gap="md">
                <div>
                  <Text fw={600}>Questions</Text>
                  <Text size="sm" c="dimmed">
                    {answeredCount} of {questions.length} answered
                  </Text>
                </div>
                {navigator}
                <Button variant="light" onClick={() => void finish()} loading={finishing} data-testid="finish-quiz-side">
                  Finish exam
                </Button>
              </Stack>
            </Card>
          </Grid.Col>
        )}
      </Grid>

      <Drawer
        opened={navOpen}
        onClose={() => setNavOpen(false)}
        position="bottom"
        title={`${answeredCount} of ${questions.length} answered`}
        radius="lg"
        styles={{ content: { height: "auto", maxHeight: "85dvh", flex: "1 1 100%", width: "100%" }, inner: { alignItems: "flex-end" } }}
      >
        <Stack gap="md" pb="md">
          {navigator}
          <Button
            onClick={() => {
              setNavOpen(false);
              void finish();
            }}
            loading={finishing}
          >
            Finish exam
          </Button>
        </Stack>
      </Drawer>

      <FinishConfirm
        opened={confirming}
        unanswered={questions.length - answeredCount}
        loading={finishing}
        onCancel={() => setConfirming(false)}
        onConfirm={onFinish}
      />
    </Box>
  );
}

function Navigator({
  questions,
  index,
  isAnswered,
  onJump,
}: {
  questions: QuizQuestion[];
  index: number;
  isAnswered: (id: string) => boolean;
  onJump: (index: number) => void;
}) {
  return (
    <nav aria-label="Questions">
      <SimpleGrid cols={5} spacing={8} data-testid="navigator">
        {questions.map((q, i) => {
          const answered = isAnswered(q.id);
          const current = i === index;
          return (
            <UnstyledButton
              key={q.id}
              onClick={() => onJump(i)}
              aria-label={`Question ${i + 1}, ${answered ? "answered" : "not answered"}`}
              aria-current={current ? "step" : undefined}
              data-answered={answered || undefined}
              data-testid="nav-question"
              h={40}
              fz="sm"
              fw={600}
              ta="center"
              bdrs="md"
              style={{
                border: `1px solid ${current ? "var(--mantine-primary-color-filled)" : answered ? "transparent" : "var(--mantine-color-default-border)"}`,
                background: answered ? "var(--mantine-primary-color-light)" : "var(--mantine-color-body)",
                color: answered ? "var(--mantine-primary-color-light-color)" : "var(--mantine-color-dimmed)",
                boxShadow: current ? "0 0 0 1px var(--mantine-primary-color-filled) inset" : undefined,
                transition: "background-color 120ms ease, border-color 120ms ease",
              }}
            >
              {i + 1}
            </UnstyledButton>
          );
        })}
      </SimpleGrid>
    </nav>
  );
}

function SaveIndicator({ state, failed, onRetry }: { state: SaveState; failed: number; onRetry: () => void }) {
  if (state === "error" || failed > 0) {
    return (
      <Group gap={6} wrap="nowrap" role="alert">
        <IconCloudOff size={16} color="var(--mantine-color-red-6)" aria-hidden="true" />
        <Text size="sm" c="red.7" style={{ whiteSpace: "nowrap" }}>
          Not saved
        </Text>
        <Button size="xs" variant="light" color="red" onClick={onRetry}>
          Retry
        </Button>
      </Group>
    );
  }
  if (state === "idle") return <Box aria-hidden="true" />;
  return (
    <Group gap={6} wrap="nowrap" role="status" aria-live="polite" data-testid="save-status">
      {state === "saving" ? (
        <IconLoader2 size={16} color="var(--mantine-color-dimmed)" aria-hidden="true" />
      ) : (
        <IconCloudCheck size={16} color="var(--mantine-color-teal-6)" aria-hidden="true" />
      )}
      <Text size="sm" c="dimmed" style={{ whiteSpace: "nowrap" }}>
        {state === "saving" ? "Saving…" : "Saved"}
      </Text>
    </Group>
  );
}
