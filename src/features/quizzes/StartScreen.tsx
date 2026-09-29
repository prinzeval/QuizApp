import { Alert, Badge, Box, Button, Card, Group, Loader, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title, UnstyledButton } from "@mantine/core";
import { IconAlertCircle, IconBulb, IconChevronRight, IconClipboardCheck, IconHistory, IconPlayerPlay } from "@tabler/icons-react";
import type { QuizAttempt, QuizMode, QuizQuestion, QuizSummary } from "../../lib/learningApi.ts";
import { plural, timeAgo } from "../../lib/format.ts";
import { DIFFICULTY_COLOR, DIFFICULTY_LABEL, MODE_LABEL, TYPE_LABEL, attemptPercent, scoreColor, uniqueTopics } from "./quizUtils.ts";
import classes from "../../components/InteractiveCard.module.css";

interface StartScreenProps {
  quiz: QuizSummary;
  questions: QuizQuestion[];
  attempts: QuizAttempt[];
  starting: QuizMode | null;
  startError: string | null;
  onStart: (mode: QuizMode) => void;
  onOpenAttempt: (attemptId: string) => void;
}

const MODES: { mode: QuizMode; icon: typeof IconBulb; title: string; body: string; detail: string }[] = [
  {
    mode: "practice",
    icon: IconBulb,
    title: "Practice",
    body: "See the answer after each question.",
    detail: "Explanations and the passage from your notes as you go.",
  },
  {
    mode: "exam",
    icon: IconClipboardCheck,
    title: "Exam",
    body: "Answers revealed at the end.",
    detail: "Move freely between questions and change answers until you finish.",
  },
];

export function StartScreen({ quiz, questions, attempts, starting, startError, onStart, onOpenAttempt }: StartScreenProps) {
  const topics = uniqueTopics(questions);
  const unfinished = attempts.find(a => !a.completedAt) ?? null;
  const finished = attempts.filter(a => a.completedAt);

  return (
    <Stack gap="xl">
      <div>
        <Group gap={6} mb="sm">
          <Badge variant="light" color={DIFFICULTY_COLOR[quiz.difficulty]}>
            {DIFFICULTY_LABEL[quiz.difficulty]}
          </Badge>
          <Badge variant="light" color="gray">
            {plural(questions.length, "question")}
          </Badge>
        </Group>
        <Title order={1} style={{ overflowWrap: "anywhere" }}>
          {quiz.title}
        </Title>
        <Text c="dimmed" mt={6}>
          {quiz.questionTypes.map(t => TYPE_LABEL[t]).join(" · ")}
          {quiz.materials.length > 0 && ` · from ${quiz.materials.map(m => m.title).join(", ")}`}
        </Text>
        {topics.length > 0 && (
          <Group gap={6} mt="md" aria-label="Topics covered">
            <Text size="sm" c="dimmed" mr={2}>
              Covers
            </Text>
            {topics.slice(0, 8).map(topic => (
              <Badge key={topic} variant="default" size="md" radius="sm" tt="none" fw={500}>
                {topic}
              </Badge>
            ))}
            {topics.length > 8 && (
              <Text size="sm" c="dimmed">
                +{topics.length - 8} more
              </Text>
            )}
          </Group>
        )}
      </div>

      {unfinished && (
        <Paper withBorder p="md" radius="lg" bg="var(--mantine-primary-color-light)" style={{ borderColor: "var(--mantine-color-clay-2)" }}>
          <Group justify="space-between" gap="md">
            <div>
              <Text fw={600}>You have an unfinished {MODE_LABEL[unfinished.mode].toLowerCase()}</Text>
              <Text size="sm" c="dimmed">
                Started {timeAgo(unfinished.startedAt)}. Your answers are saved.
              </Text>
            </div>
            <Button leftSection={<IconPlayerPlay size={16} />} onClick={() => onOpenAttempt(unfinished.id)} data-testid="resume-attempt">
              Resume
            </Button>
          </Group>
        </Paper>
      )}

      <div>
        <Title order={2} mb="sm">
          {unfinished ? "Or start fresh" : "Choose how to take it"}
        </Title>
        {startError && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert" mb="sm">
            {startError}
          </Alert>
        )}
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
          {MODES.map(({ mode, icon: Icon, title, body, detail }) => (
            <Card
              key={mode}
              component="button"
              type="button"
              onClick={() => starting === null && onStart(mode)}
              className={classes.card}
              shadow="xs"
              data-testid={`mode-${mode}`}
              aria-busy={starting === mode}
              aria-label={`Start in ${title.toLowerCase()} mode: ${body}`}
              style={{ textAlign: "left" }}
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <ThemeIcon size={44} radius="md" variant="light" color={mode === "exam" ? "grape" : "clay"}>
                  <Icon size={24} stroke={1.6} />
                </ThemeIcon>
                {starting === mode ? <Loader size="sm" /> : <IconChevronRight size={20} color="var(--mantine-color-dimmed)" aria-hidden="true" />}
              </Group>
              <Title order={3} mt="md">
                {title}
              </Title>
              <Text fw={500} mt={4}>
                {body}
              </Text>
              <Text size="sm" c="dimmed" mt={4}>
                {detail}
              </Text>
            </Card>
          ))}
        </SimpleGrid>
      </div>

      {finished.length > 0 && (
        <div>
          <Group gap={8} mb="sm">
            <IconHistory size={18} stroke={1.8} aria-hidden="true" />
            <Title order={2}>Your attempts</Title>
          </Group>
          <Card padding={0}>
            <Stack gap={0} component="ul" p={0} m={0} style={{ listStyle: "none" }}>
              {finished.map((attempt, i) => {
                const score = attemptPercent(attempt);
                return (
                  <Box component="li" key={attempt.id} style={i > 0 ? { borderTop: "1px solid var(--mantine-color-default-border)" } : undefined}>
                    <UnstyledButton
                      onClick={() => onOpenAttempt(attempt.id)}
                      w="100%"
                      px="lg"
                      py="sm"
                      mih={56}
                      data-testid="past-attempt"
                      aria-label={`${MODE_LABEL[attempt.mode]}, ${attempt.correctCount} of ${attempt.totalCount}, ${timeAgo(attempt.completedAt!)}. View review`}
                    >
                      <Group justify="space-between" wrap="nowrap" gap="md">
                        <Group gap="md" wrap="nowrap" miw={0}>
                          <Badge color={scoreColor(score)} variant="light" size="lg" w={64} style={{ flexShrink: 0 }}>
                            {score}%
                          </Badge>
                          <div style={{ minWidth: 0 }}>
                            <Text size="sm" fw={600}>
                              {attempt.correctCount} / {attempt.totalCount} · {MODE_LABEL[attempt.mode]}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {timeAgo(attempt.completedAt!)}
                            </Text>
                          </div>
                        </Group>
                        <Group gap={4} wrap="nowrap" c="dimmed">
                          <Text size="sm" visibleFrom="xs">
                            Review
                          </Text>
                          <IconChevronRight size={16} aria-hidden="true" />
                        </Group>
                      </Group>
                    </UnstyledButton>
                  </Box>
                );
              })}
            </Stack>
          </Card>
        </div>
      )}

    </Stack>
  );
}
