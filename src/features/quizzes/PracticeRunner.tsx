import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert, Box, Button, Group, Kbd, Paper, Stack, Text, ThemeIcon, VisuallyHidden } from "@mantine/core";
import { IconAlertCircle, IconArrowRight, IconCheck, IconFlag, IconX } from "@tabler/icons-react";
import { useAnswer } from "../../hooks/learning.ts";
import { useIsMobile } from "../../hooks/useIsMobile.ts";
import type { QuestionReview, QuizQuestion, QuizSummary } from "../../lib/learningApi.ts";
import { QuestionView } from "./QuestionView.tsx";
import { SourceNote } from "./SourceNote.tsx";
import { FinishConfirm, RunnerHeader, focusOption, isActivatable, usePatchAttempt, useQuizKeys, type AttemptData } from "./playerParts.tsx";
import { correctText, isReview, keyToOption } from "./quizUtils.ts";

interface PracticeRunnerProps {
  roomId: string;
  quiz: QuizSummary;
  questions: QuizQuestion[];
  data: AttemptData;
  finishing: boolean;
  finishError: string | null;
  onFinish: () => void;
}

/** Practice: answer, see if you're right with the explanation and source, then move on. */
export function PracticeRunner({ roomId, quiz, questions, data, finishing, finishError, onFinish }: PracticeRunnerProps) {
  const attemptId = data.attempt.id;
  const answer = useAnswer(roomId, quiz.id, attemptId);
  const patchAttempt = usePatchAttempt(roomId, quiz.id, attemptId);
  const mobile = useIsMobile();

  const [reviews, setReviews] = useState<Record<string, QuestionReview>>(() =>
    Object.fromEntries(data.questions.filter(isReview).map(q => [q.id, q])),
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // Resume at the first question not yet answered.
  const [index, setIndex] = useState(() => {
    const first = questions.findIndex(q => !reviews[q.id]);
    return first === -1 ? questions.length - 1 : first;
  });
  const [confirming, setConfirming] = useState(false);

  const question = questions[index];
  const review = reviews[question.id] ?? null;
  const value = review ? review.response ?? "" : drafts[question.id] ?? "";
  const answeredCount = Object.keys(reviews).length;
  const correctCount = Object.values(reviews).filter(r => r.isCorrect).length;
  const isLast = index === questions.length - 1;
  const allAnswered = answeredCount === questions.length;

  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // New question: bring it into view and move focus to it (the input on desktop for typed answers).
  useLayoutEffect(() => {
    topRef.current?.scrollIntoView({ block: "nearest" });
    if (question.type === "fill_blank" && !mobile && !reviews[question.id]) inputRef.current?.focus();
    else headingRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // After checking, focus "Next" so Enter/Space carries on.
  useEffect(() => {
    if (review) nextRef.current?.focus();
  }, [review]);

  const setDraft = (next: string) => setDrafts(d => ({ ...d, [question.id]: next }));

  const submit = () => {
    if (review || answer.isPending) return;
    const response = value.trim();
    if (!response) return;
    answer.mutate(
      { questionId: question.id, response },
      {
        onSuccess: result => {
          if (!result.review) return;
          setReviews(r => ({ ...r, [question.id]: result.review! }));
          patchAttempt(result.review);
        },
      },
    );
  };

  const next = () => {
    if (!review) return;
    if (isLast) {
      if (allAnswered) onFinish();
      else setConfirming(true);
      return;
    }
    answer.reset();
    setIndex(i => i + 1);
  };

  useQuizKeys(event => {
    if (event.key === "Enter") {
      if (isActivatable(event)) return;
      const target = event.target as HTMLElement;
      // Enter on an unselected option selects it (native click); on the selected one it checks the answer.
      if (target.getAttribute("role") === "radio" && target.getAttribute("aria-checked") !== "true") return;
      event.preventDefault();
      if (review) next();
      else submit();
      return;
    }
    if (review) return;
    const option = keyToOption(event.key, question.type, question.options?.length ?? 0);
    if (option !== null) {
      event.preventDefault();
      setDraft(String(option));
      focusOption(option);
    }
  }, !confirming);

  const verdict = review ? (review.isCorrect ? "Correct!" : "Not quite") : "";

  return (
    <Box ref={topRef} style={{ scrollMarginTop: 24 }}>
      <RunnerHeader
        title={quiz.title}
        mode="practice"
        index={index}
        total={questions.length}
        done={answeredCount}
        right={
          <Group gap="xs" wrap="nowrap">
            {answeredCount > 0 && (
              <Text size="sm" c="dimmed" visibleFrom="xs" style={{ whiteSpace: "nowrap" }}>
                {correctCount} correct
              </Text>
            )}
            <Button variant="subtle" color="gray" size="sm" leftSection={<IconFlag size={16} />} onClick={() => setConfirming(true)} data-testid="end-early">
              End
            </Button>
          </Group>
        }
      />

      <Stack gap="xl">
        <QuestionView
          key={question.id}
          question={question}
          value={value}
          onChange={setDraft}
          onSubmit={() => (review ? next() : submit())}
          review={review}
          disabled={answer.isPending}
          headingRef={headingRef}
          inputRef={inputRef}
        />

        <VisuallyHidden role="status" aria-live="polite">
          {review ? `${verdict} ${review.isCorrect ? "" : `The answer is ${correctText(review).answer}.`}` : ""}
        </VisuallyHidden>

        {review && <Feedback review={review} />}

        {answer.isError && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert" title="Couldn't check your answer">
            <Text size="sm">{answer.error.message}</Text>
            <Button size="xs" variant="light" color="red" mt="xs" onClick={submit}>
              Try again
            </Button>
          </Alert>
        )}

        {finishError && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert" title="Couldn't finish the quiz">
            <Text size="sm">{finishError}</Text>
            <Button size="xs" variant="light" color="red" mt="xs" onClick={onFinish} loading={finishing}>
              Try again
            </Button>
          </Alert>
        )}

        <Group justify="space-between" gap="sm" wrap="nowrap">
          <Text size="xs" c="dimmed" visibleFrom="sm">
            {review ? (
              <>
                <Kbd size="xs">Enter</Kbd> to continue
              </>
            ) : question.type === "fill_blank" ? (
              <>
                <Kbd size="xs">Enter</Kbd> to check
              </>
            ) : (
              <>
                <Kbd size="xs">{question.type === "true_false" ? "T" : "1"}</Kbd>–<Kbd size="xs">{question.type === "true_false" ? "F" : "4"}</Kbd> to choose ·{" "}
                <Kbd size="xs">Enter</Kbd> to check
              </>
            )}
          </Text>
          {review ? (
            <Button
              ref={nextRef}
              size="md"
              rightSection={isLast ? undefined : <IconArrowRight size={18} />}
              onClick={next}
              loading={finishing}
              data-testid={isLast ? "finish-quiz" : "next-question"}
              fullWidth={mobile}
            >
              {isLast ? "See results" : "Next question"}
            </Button>
          ) : (
            <Button size="md" onClick={submit} disabled={!value.trim()} loading={answer.isPending} data-testid="submit-answer" fullWidth={mobile}>
              Check answer
            </Button>
          )}
        </Group>
      </Stack>

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

function Feedback({ review }: { review: QuestionReview }) {
  const correct = !!review.isCorrect;
  const { answer, alsoAccepted } = correctText(review);
  const color = correct ? "teal" : "red";
  return (
    <Paper
      p={{ base: "md", sm: "lg" }}
      radius="lg"
      bg={`var(--mantine-color-${color}-light)`}
      style={{ border: `1px solid var(--mantine-color-${color}-light-hover)` }}
      data-testid="feedback"
      data-correct={correct}
    >
      <Stack gap="sm">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon color={color} radius="xl" size={32}>
            {correct ? <IconCheck size={18} stroke={3} /> : <IconX size={18} stroke={3} />}
          </ThemeIcon>
          <Text fw={700} size="lg" c={`var(--mantine-color-${color}-light-color)`} ff="var(--mantine-font-family-headings)">
            {correct ? "Correct!" : "Not quite"}
          </Text>
        </Group>
        {!correct && (
          <Text size="sm">
            The answer is <strong>{answer}</strong>
            {alsoAccepted.length > 0 && <Text span size="sm" c="dimmed">{` (also accepted: ${alsoAccepted.join(", ")})`}</Text>}
          </Text>
        )}
        {review.explanation && (
          <Text size="sm" style={{ overflowWrap: "anywhere" }}>
            {review.explanation}
          </Text>
        )}
        <SourceNote source={review.source} />
      </Stack>
    </Paper>
  );
}
