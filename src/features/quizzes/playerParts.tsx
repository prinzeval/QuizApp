import { useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Group, Modal, Progress, Stack, Text } from "@mantine/core";
import { queryKeys } from "../../hooks/queryKeys.ts";
import type { QuestionPending, QuestionReview, QuizAttempt, QuizMode } from "../../lib/learningApi.ts";
import { plural } from "../../lib/format.ts";
import { MODE_LABEL } from "./quizUtils.ts";

export type AttemptData = { attempt: QuizAttempt; questions: Array<QuestionReview | QuestionPending> };

/**
 * Keeps the cached attempt in step with answers given on this page, so coming
 * back to it (without a reload) resumes from the right place.
 */
export function usePatchAttempt(roomId: string, quizId: string, attemptId: string) {
  const queryClient = useQueryClient();
  return (entry: QuestionReview | QuestionPending) =>
    queryClient.setQueryData<AttemptData>(queryKeys.attempt(roomId, quizId, attemptId), current =>
      current ? { ...current, questions: current.questions.map(q => (q.id === entry.id ? entry : q)) } : current,
    );
}

/**
 * Global quiz shortcuts. Ignores keys typed into fields, with modifiers held,
 * or inside dialogs. The handler can change every render; the listener doesn't.
 */
export function useQuizKeys(handler: (event: KeyboardEvent) => void, enabled = true) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]')) return;
      latest.current(event);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

/** Focus the nth answer option (after choosing it with a shortcut). */
export function focusOption(index: number) {
  requestAnimationFrame(() => document.querySelectorAll<HTMLElement>('[data-testid="option"]')[index]?.focus());
}

/** Whether a key event came from a focused button/link that Enter would activate natively. */
export function isActivatable(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return !!target?.closest('button:not([role="radio"]), a[href]');
}

export function RunnerHeader({
  title,
  mode,
  index,
  total,
  done,
  right,
}: {
  title: string;
  mode: QuizMode;
  index: number;
  total: number;
  /** How many questions are answered, for the progress bar. */
  done: number;
  right?: ReactNode;
}) {
  return (
    <Stack gap={10} mb="xl">
      <Group justify="space-between" gap="sm" wrap="nowrap">
        <Group gap={8} miw={0} wrap="nowrap">
          <Badge variant="light" color={mode === "exam" ? "grape" : "clay"} style={{ flexShrink: 0 }}>
            {MODE_LABEL[mode]}
          </Badge>
          <Text size="sm" c="dimmed" truncate visibleFrom="sm">
            {title}
          </Text>
        </Group>
        {right}
      </Group>
      <Progress
        value={total ? (100 * done) / total : 0}
        size="md"
        radius="xl"
        transitionDuration={300}
        aria-label={`${done} of ${plural(total, "question")} answered`}
      />
      <Text size="sm" fw={600} aria-live="polite" data-testid="question-counter">
        Question {index + 1} of {total}
      </Text>
    </Stack>
  );
}

/** "Finish now?" with a note about unanswered questions counting as wrong. */
export function FinishConfirm({
  opened,
  unanswered,
  loading,
  onCancel,
  onConfirm,
}: {
  opened: boolean;
  unanswered: number;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal opened={opened} onClose={onCancel} title="Finish the quiz?">
      <Stack gap="md">
        <Text size="sm">
          {unanswered > 0 ? (
            <>
              You have <strong>{plural(unanswered, "unanswered question")}</strong>. {unanswered === 1 ? "It" : "They"}'ll count as wrong.
            </>
          ) : (
            "You've answered everything. Ready to see how you did?"
          )}
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onCancel} data-autofocus>
            Keep going
          </Button>
          <Button onClick={onConfirm} loading={loading} data-testid="confirm-finish">
            {unanswered > 0 ? "Finish anyway" : "See results"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
