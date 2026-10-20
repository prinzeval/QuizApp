import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Group, Input, Modal, Paper, Select, Slider, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconAlertCircle, IconChevronRight, IconLock, IconTargetArrow } from "@tabler/icons-react";
import { useCreateMistakesQuiz, useQuizMistakes } from "../../hooks/learning.ts";
import { plural } from "../../lib/format.ts";
import { notify } from "../../notify.ts";
import { mistakesCountRange } from "./quizUtils.ts";

/**
 * "Review my mistakes (12)": shown when I've got questions wrong in this room.
 * Opens a small picker (all topics or one, how many), then makes a private quiz and opens it.
 */
export function MistakesReview({ roomId }: { roomId: string }) {
  const mistakes = useQuizMistakes(roomId);
  const [open, setOpen] = useState(false);
  const count = mistakes.data?.count ?? 0;
  if (count === 0) return null;

  return (
    <>
      <Paper withBorder p="md" radius="lg" mb="lg" bg="var(--mantine-primary-color-light)" style={{ borderColor: "var(--mantine-color-clay-2)" }} data-testid="mistakes-card">
        <Group justify="space-between" gap="md">
          <Group gap="md" wrap="nowrap" miw={0} style={{ flex: "1 1 240px" }}>
            <ThemeIcon size={40} radius="md" variant="white" color="clay" style={{ flexShrink: 0 }}>
              <IconTargetArrow size={22} stroke={1.7} />
            </ThemeIcon>
            <div style={{ minWidth: 0 }}>
              <Text fw={600}>Learn from your mistakes</Text>
              <Text size="sm" c="dimmed">
                {plural(count, "question")} you got wrong, in a quick private quiz.
              </Text>
            </div>
          </Group>
          <Button rightSection={<IconChevronRight size={16} />} onClick={() => setOpen(true)} data-testid="review-mistakes" style={{ flexGrow: 1, maxWidth: 320 }}>
            Review my mistakes ({count})
          </Button>
        </Group>
      </Paper>

      <Modal opened={open} onClose={() => setOpen(false)} title="Review my mistakes">
        {open && mistakes.data && <MistakesForm roomId={roomId} count={count} topics={mistakes.data.topics} onCancel={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

const ALL = "__all_topics__";

function MistakesForm({ roomId, count, topics, onCancel }: { roomId: string; count: number; topics: { topic: string; count: number }[]; onCancel: () => void }) {
  const create = useCreateMistakesQuiz(roomId);
  const navigate = useNavigate();
  const [topic, setTopic] = useState<string | null>(null);
  const available = topic ? (topics.find(t => t.topic === topic)?.count ?? 0) : count;
  const range = mistakesCountRange(available);
  const [size, setSize] = useState(range.max);
  const shown = Math.min(Math.max(size, range.min), range.max);

  const submit = () =>
    create.mutate(
      { topic: topic ?? undefined, count: range.adjustable ? shown : undefined },
      {
        onSuccess: ({ quiz }) => {
          onCancel();
          navigate(`/rooms/${roomId}/quizzes/${quiz.id}`);
        },
        onError: error => notify(error.message, "error"),
      },
    );

  return (
    <Stack gap="lg">
      {create.isError && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
          {create.error.message}
        </Alert>
      )}
      <Text size="sm" c="dimmed">
        A new quiz with the questions you last answered wrong in this room, pictures included. It's ready straight away.
      </Text>

      {topics.length > 1 && (
        <Select
          label="Topic"
          data={[{ value: ALL, label: `All topics (${count})` }, ...topics.map(t => ({ value: t.topic, label: `${t.topic} (${t.count})` }))]}
          value={topic ?? ALL}
          onChange={value => {
            const picked = value && value !== ALL ? value : null;
            setTopic(picked);
            const next = mistakesCountRange(picked ? (topics.find(t => t.topic === picked)?.count ?? 0) : count);
            setSize(next.max);
          }}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true }}
          data-testid="mistakes-topic"
        />
      )}

      {range.adjustable ? (
        <Input.Wrapper
          label={
            <>
              Questions:{" "}
              <Text span fw={700} c="var(--mantine-primary-color-filled)">
                {shown}
              </Text>
            </>
          }
        >
          <Slider mt="xs" mb="sm" min={range.min} max={range.max} value={shown} onChange={setSize} label={null} thumbLabel="Number of questions" size="md" thumbSize={24} />
        </Input.Wrapper>
      ) : (
        <Text size="sm">{plural(available, "question")}</Text>
      )}

      <Group gap={6} c="dimmed" wrap="nowrap">
        <IconLock size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
        <Text size="xs" c="inherit">
          Only you see this quiz.
        </Text>
      </Group>

      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={submit} loading={create.isPending} leftSection={<IconTargetArrow size={16} />} data-testid="create-mistakes-quiz">
          Start review
        </Button>
      </Group>
    </Stack>
  );
}
