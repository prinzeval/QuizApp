import { Link } from "react-router-dom";
import { ActionIcon, Badge, Button, Card, Group, Loader, Menu, RingProgress, Skeleton, Stack, Text, Title, Tooltip } from "@mantine/core";
import { IconAlertTriangle, IconDots, IconPlayerPlay, IconRefresh, IconRotate, IconTrash } from "@tabler/icons-react";
import type { QuizSummary } from "../../lib/learningApi.ts";
import { plural, timeAgo } from "../../lib/format.ts";
import { DIFFICULTY_COLOR, DIFFICULTY_LABEL, TYPE_LABEL, scoreColor } from "./quizUtils.ts";

interface QuizCardProps {
  quiz: QuizSummary;
  roomId: string;
  canManage: boolean;
  isMine: boolean;
  retrying: boolean;
  onRetry: () => void;
  onDelete: () => void;
}

const STATUS = {
  generating: { label: "Generating", color: "clay" },
  ready: { label: "Ready", color: "teal" },
  failed: { label: "Failed", color: "red" },
} as const;

export function QuizCard({ quiz, roomId, canManage, isMine, retrying, onRetry, onDelete }: QuizCardProps) {
  const status = STATUS[quiz.status];
  const taken = quiz.myCompletedAttempts > 0;
  const best = quiz.myBestScore;

  return (
    <Card component="li" data-testid="quiz-card" h="100%" shadow="xs" aria-busy={quiz.status === "generating"}>
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Stack gap={6} miw={0} flex={1}>
          <Group gap={6}>
            <Badge
              size="sm"
              variant="light"
              color={status.color}
              data-testid="quiz-card-status"
              leftSection={quiz.status === "generating" ? <Loader size={10} color="clay" type="oval" aria-hidden="true" /> : undefined}
            >
              {status.label}
            </Badge>
            {quiz.status === "ready" && (
              <Badge size="sm" variant="light" color={DIFFICULTY_COLOR[quiz.difficulty]}>
                {DIFFICULTY_LABEL[quiz.difficulty]}
              </Badge>
            )}
          </Group>
          <Title order={3} lineClamp={2} data-testid="quiz-card-title" style={{ overflowWrap: "anywhere" }}>
            {quiz.title || "Untitled quiz"}
          </Title>
        </Stack>

        {quiz.status === "ready" && taken && best !== null ? (
          <Tooltip label={`Your best score from ${plural(quiz.myCompletedAttempts, "attempt")}`} withArrow>
            <RingProgress
              size={56}
              thickness={5}
              roundCaps
              sections={[{ value: best, color: scoreColor(best) }]}
              aria-label={`Best score ${best}%`}
              label={
                <Text ta="center" size="xs" fw={700}>
                  {best}%
                </Text>
              }
            />
          </Tooltip>
        ) : null}

        {canManage && (
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size={40} aria-label={`More actions for ${quiz.title || "quiz"}`} data-testid="quiz-card-menu">
                <IconDots size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={onDelete} data-testid="delete-quiz">
                Delete quiz
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>

      {quiz.status === "generating" && (
        <Stack gap={8} mt="md" flex={1}>
          <Text size="sm" c="dimmed" role="status">
            Writing {plural(quiz.requestedCount, "question")} from your notes…
          </Text>
          <Skeleton h={8} w="92%" radius="xl" />
          <Skeleton h={8} w="74%" radius="xl" />
          <Skeleton h={8} w="58%" radius="xl" />
        </Stack>
      )}

      {quiz.status === "failed" && (
        <Stack gap="sm" mt="md" flex={1}>
          <Group gap={8} wrap="nowrap" align="flex-start">
            <IconAlertTriangle size={18} color="var(--mantine-color-red-6)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
            <Text size="sm" c="dimmed" lineClamp={3}>
              {quiz.error || "Something went wrong while writing this quiz."}
            </Text>
          </Group>
        </Stack>
      )}

      {quiz.status === "ready" && (
        <Stack gap={4} mt="sm" flex={1}>
          <Text size="sm">
            {plural(quiz.questionCount, "question")} · {quiz.questionTypes.map(t => TYPE_LABEL[t]).join(", ")}
          </Text>
          {quiz.focus && (
            <Text size="sm" c="dimmed" lineClamp={1}>
              Focus: {quiz.focus}
            </Text>
          )}
          {quiz.materials.length > 0 && (
            <Text size="sm" c="dimmed" lineClamp={1} title={quiz.materials.map(m => m.title).join(", ")}>
              From {quiz.materials.map(m => m.title).join(", ")}
            </Text>
          )}
        </Stack>
      )}

      <Group justify="space-between" align="center" mt="md" gap="sm" wrap="nowrap">
        <Text size="xs" c="dimmed" lineClamp={2} miw={0}>
          {isMine ? "You" : quiz.creatorName ?? "Someone"} · {timeAgo(quiz.createdAt)}
          {quiz.status === "ready" && taken ? ` · ${plural(quiz.myCompletedAttempts, "attempt")}` : ""}
        </Text>
        {quiz.status === "ready" && (
          <Button
            component={Link}
            to={`/rooms/${roomId}/quizzes/${quiz.id}`}
            variant={taken ? "light" : "filled"}
            size="sm"
            leftSection={taken ? <IconRotate size={16} /> : <IconPlayerPlay size={16} />}
            style={{ flexShrink: 0 }}
            data-testid="start-quiz"
          >
            {taken ? "Retake" : "Start"}
          </Button>
        )}
        {quiz.status === "failed" && canManage && (
          <Button variant="light" size="sm" leftSection={<IconRefresh size={16} />} loading={retrying} onClick={onRetry} style={{ flexShrink: 0 }} data-testid="retry-quiz">
            Retry
          </Button>
        )}
      </Group>
    </Card>
  );
}
