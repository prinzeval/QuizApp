import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Box, Button, Card, Group, Progress, RingProgress, SegmentedControl, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconArrowLeft, IconCheck, IconMinus, IconRotate, IconSchool, IconX } from "@tabler/icons-react";
import { Scribble } from "../../components/Doodles.tsx";
import type { QuestionReview, QuizAttempt, QuizMode } from "../../lib/learningApi.ts";
import { formatDate } from "../../lib/format.ts";
import { BlankPrompt } from "./QuestionView.tsx";
import { SourceNote } from "./SourceNote.tsx";
import { LabelImageReview, LocateImageReview } from "./PictureQuestion.tsx";
import { FigureCrop } from "../figures/FigureCrop.tsx";
import { MODE_LABEL, OPTION_LETTERS, TYPE_LABEL, correctText, percent, responseText, scoreColor, scoreMessage, topicBreakdown } from "./quizUtils.ts";

interface ResultsProps {
  roomId: string;

  attempt: QuizAttempt;
  reviews: QuestionReview[];
  starting: QuizMode | null;
  onStart: (mode: QuizMode) => void;
}

export function Results({ roomId, attempt, reviews, starting, onStart }: ResultsProps) {
  const correct = attempt.correctCount ?? reviews.filter(r => r.isCorrect).length;
  const total = attempt.totalCount ?? reviews.length;
  const score = percent(correct, total);
  const message = scoreMessage(score);
  const topics = topicBreakdown(reviews);
  const missed = reviews.filter(r => !r.isCorrect);
  const [filter, setFilter] = useState<"all" | "missed">("all");
  const shown = filter === "missed" ? missed : reviews;
  const otherMode: QuizMode = attempt.mode === "exam" ? "practice" : "exam";

  // Land focus on the result so screen readers hear it.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [attempt.id]);

  return (
    <Stack gap="xl">
      <Card padding="xl" data-testid="results">
        <Stack align="center" gap="md" ta="center">
          <RingProgress
            size={168}
            thickness={12}
            roundCaps
            sections={[{ value: score, color: scoreColor(score) }]}
            rootColor="var(--mantine-color-default-hover)"
            label={
              <Stack gap={0} align="center">
                <Text fz={36} fw={700} lh={1} ff="var(--mantine-font-family-headings)">
                  {score}%
                </Text>
              </Stack>
            }
            aria-hidden="true"
          />
          <div>
            <Title order={1} ref={headingRef} tabIndex={-1} style={{ outline: "none" }} fz={{ base: "1.625rem", sm: "2rem" }}>
              {score >= 80 ? <Scribble>{message.title}</Scribble> : message.title}
            </Title>
            <Text size="lg" fw={600} mt="sm" data-testid="score" aria-label={`You scored ${correct} out of ${total}, ${score} percent`}>
              {correct} / {total}
            </Text>
            <Text c="dimmed" mt={6} maw={460} mx="auto">
              {message.body}
            </Text>
            <Text size="xs" c="dimmed" mt="sm">
              {MODE_LABEL[attempt.mode]} · {formatDate(attempt.completedAt ?? attempt.startedAt)}
            </Text>
          </div>
          <Group justify="center" gap="sm" mt="xs">
            <Button leftSection={<IconRotate size={16} />} onClick={() => onStart(attempt.mode)} loading={starting === attempt.mode} data-testid="retake">
              Retake
            </Button>
            <Button
              variant="default"
              leftSection={<IconSchool size={16} />}
              onClick={() => onStart(otherMode)}
              loading={starting === otherMode}
              data-testid={otherMode === "practice" ? "practice-again" : "try-exam"}
            >
              {otherMode === "practice" ? "Practice again" : "Try exam mode"}
            </Button>
            <Button component={Link} to={`/rooms/${roomId}?tab=quizzes`} variant="subtle" color="gray" leftSection={<IconArrowLeft size={16} />}>
              Back to quizzes
            </Button>
          </Group>
        </Stack>
      </Card>

      {topics.length > 1 && (
        <Card>
          <Title order={2} mb="md">
            By topic
          </Title>
          <Stack gap="sm" component="ul" p={0} m={0} style={{ listStyle: "none" }}>
            {topics.map(t => {
              const value = percent(t.correct, t.total);
              return (
                <li key={t.topic}>
                  <Group justify="space-between" gap="sm" wrap="nowrap" mb={4}>
                    <Text size="sm" fw={500} truncate>
                      {t.topic}
                    </Text>
                    <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
                      {t.correct}/{t.total}
                    </Text>
                  </Group>
                  <Progress value={value} color={scoreColor(value)} size="sm" radius="xl" aria-label={`${t.topic}: ${value}%`} />
                </li>
              );
            })}
          </Stack>
        </Card>
      )}

      <Stack gap="md">
        <Group justify="space-between" align="center" gap="sm">
          <Title order={2}>Review answers</Title>
          {missed.length > 0 && missed.length < reviews.length && (
            <SegmentedControl
              size="sm"
              value={filter}
              onChange={v => setFilter(v as "all" | "missed")}
              data={[
                { value: "all", label: `All ${reviews.length}` },
                { value: "missed", label: `Missed ${missed.length}` },
              ]}
              aria-label="Show questions"
            />
          )}
        </Group>
        <Stack gap="sm" component="ol" p={0} m={0} style={{ listStyle: "none" }}>
          {shown.map(review => (
            <ReviewItem key={review.id} roomId={roomId} review={review} number={reviews.indexOf(review) + 1} />
          ))}
        </Stack>
      </Stack>
    </Stack>
  );
}

function ReviewItem({ roomId, review, number }: { roomId: string; review: QuestionReview; number: number }) {
  const picture = review.type === "label_image" || review.type === "locate_image";
  const status = review.response === null ? "skipped" : review.isCorrect ? "correct" : "wrong";
  const color = status === "correct" ? "teal" : status === "wrong" ? "red" : "gray";
  const yours = responseText(review, review.response);
  const { answer, alsoAccepted } = correctText(review);
  const letter = (text: string) => {
    if (review.type !== "multiple_choice") return "";
    const i = review.options?.indexOf(text) ?? -1;
    return i >= 0 ? `${OPTION_LETTERS[i]}. ` : "";
  };

  return (
    <Card component="li" padding="lg" data-testid="review-item" data-status={status}>
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <ThemeIcon color={color} variant={status === "skipped" ? "light" : "filled"} radius="xl" size={28} mt={2} aria-label={status === "skipped" ? "Not answered" : status === "correct" ? "Correct" : "Incorrect"} role="img">
          {status === "correct" ? <IconCheck size={16} stroke={3} /> : status === "wrong" ? <IconX size={16} stroke={3} /> : <IconMinus size={16} stroke={3} />}
        </ThemeIcon>
        <Stack gap="sm" miw={0} flex={1}>
          <Group gap={6}>
            <Text size="xs" c="dimmed" fw={600}>
              Question {number}
            </Text>
            {review.topic && (
              <Badge variant="light" color="gray" size="sm" radius="sm" tt="none" fw={600}>
                {review.topic}
              </Badge>
            )}
            <Text size="xs" c="dimmed">
              {TYPE_LABEL[review.type]}
            </Text>
          </Group>
          <Text fw={600} style={{ overflowWrap: "anywhere" }}>
            {review.type === "fill_blank" ? <BlankPrompt prompt={review.prompt} value="" review={null} /> : review.prompt}
          </Text>
          {review.type === "label_image" && <LabelImageReview roomId={roomId} review={review} />}
          {review.type === "locate_image" && (
            <>
              <LocateImageReview roomId={roomId} review={review} />
              <Text size="sm" c="dimmed">
                {review.response === null ? "Not answered. " : review.isCorrect ? "You found it. " : "Your tap missed. "}
                The highlighted area is {correctText(review).answer.replace(/, highlighted on the picture$/, "")}.
              </Text>
            </>
          )}
          {review.figure && !picture && (
            <Box maw={560}>
              <FigureCrop roomId={roomId} figure={review.figure} maxHeight={320} label={review.figure.title} />
              {review.figure.caption && (
                <Text size="xs" c="dimmed" mt={4}>
                  {review.figure.caption}
                </Text>
              )}
            </Box>
          )}
          {!picture && (
          <Box>
            <Text size="sm" style={{ overflowWrap: "anywhere" }}>
              <Text span size="sm" c="dimmed">
                Your answer:{" "}
              </Text>
              {yours ? (
                <Text span size="sm" fw={600} c={status === "correct" ? "var(--mantine-color-teal-light-color)" : "var(--mantine-color-red-light-color)"} td={status === "wrong" ? "line-through" : undefined}>
                  {letter(yours)}
                  {yours}
                </Text>
              ) : (
                <Text span size="sm" fs="italic" c="dimmed">
                  No answer
                </Text>
              )}
            </Text>
            {status !== "correct" && (
              <Text size="sm" mt={4} style={{ overflowWrap: "anywhere" }}>
                <Text span size="sm" c="dimmed">
                  Correct answer:{" "}
                </Text>
                <Text span size="sm" fw={600} c="var(--mantine-color-teal-light-color)">
                  {letter(answer)}
                  {answer}
                </Text>
                {alsoAccepted.length > 0 && (
                  <Text span size="sm" c="dimmed">
                    {` (also: ${alsoAccepted.join(", ")})`}
                  </Text>
                )}
              </Text>
            )}
          </Box>
          )}
          {review.explanation && (
            <Text size="sm" c="dimmed" style={{ overflowWrap: "anywhere" }}>
              {review.explanation}
            </Text>
          )}
          <SourceNote source={review.source} />
        </Stack>
      </Group>
    </Card>
  );
}
