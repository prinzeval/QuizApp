import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button, EmptyState, Group, Modal, SimpleGrid, Skeleton, Stack, Text, Title } from "@mantine/core";
import { IconAlertCircle, IconListCheck, IconPlus } from "@tabler/icons-react";
import { useAuth } from "../../auth/AuthContext.tsx";
import { FormModal } from "../../components/FormModal.tsx";
import { useDeleteQuiz, useQuizzes, useRetryQuiz } from "../../hooks/learning.ts";
import type { Room } from "../../lib/api.ts";
import type { QuizSummary } from "../../lib/learningApi.ts";
import { plural } from "../../lib/format.ts";
import { notify } from "../../notify.ts";
import { NewQuizForm } from "./NewQuizForm.tsx";
import { QuizCard } from "./QuizCard.tsx";

export function QuizzesTab({ room }: { room: Room }) {
  const { user } = useAuth();
  const quizzes = useQuizzes(room.id);
  const retryQuiz = useRetryQuiz(room.id);
  const [searchParams, setSearchParams] = useSearchParams();
  const [creating, setCreating] = useState<{ focus: string } | null>(null);
  const [deleting, setDeleting] = useState<QuizSummary | null>(null);

  // Deep link from Progress: ?tab=quizzes&focus=<topic> opens the form pre-filled, then tidies the URL.
  const focusParam = searchParams.get("focus");
  useEffect(() => {
    if (focusParam === null) return;
    setCreating({ focus: focusParam });
    setSearchParams(
      current => {
        const next = new URLSearchParams(current);
        next.delete("focus");
        return next;
      },
      { replace: true },
    );
  }, [focusParam, setSearchParams]);

  const canManage = (quiz: QuizSummary) => room.role === "owner" || (!!user && quiz.createdBy === user.id);
  const list = quizzes.data?.quizzes ?? [];

  const newQuizButton = (
    <Button leftSection={<IconPlus size={16} stroke={2.5} />} onClick={() => setCreating({ focus: "" })} data-testid="new-quiz">
      New quiz
    </Button>
  );

  return (
    <>
      <Group justify="space-between" align="flex-end" gap="md" mb="lg">
        <div>
          <Title order={2}>Quizzes</Title>
          <Text size="sm" c="dimmed" mt={2}>
            {list.length > 0 ? `${plural(list.length, "quiz")} written from this room's notes.` : "Test yourself on this room's notes."}
          </Text>
        </div>
        {list.length > 0 && newQuizButton}
      </Group>

      {quizzes.isPending ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md" aria-busy="true" aria-label="Loading quizzes">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} h={196} radius="lg" />
          ))}
        </SimpleGrid>
      ) : quizzes.isError ? (
        <EmptyState title="Couldn't load quizzes" description={quizzes.error.message} py={56} bd="1px dashed var(--mantine-color-default-border)" bdrs="lg">
          <EmptyState.Actions>
            <Button variant="default" onClick={() => quizzes.refetch()}>
              Try again
            </Button>
          </EmptyState.Actions>
        </EmptyState>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<IconListCheck size={40} stroke={1.4} color="var(--mantine-primary-color-filled)" />}
          title="No quizzes yet"
          description="Generate a quiz from your notes. Pick the materials, how many questions and how hard, and we'll write them in seconds."
          py={56}
          px="md"
          bd="1px dashed var(--mantine-color-default-border)"
          bdrs="lg"
        >
          <EmptyState.Actions>{newQuizButton}</EmptyState.Actions>
        </EmptyState>
      ) : (
        <SimpleGrid component="ul" cols={{ base: 1, sm: 2, lg: 3 }} spacing="md" p={0} m={0} style={{ listStyle: "none" }}>
          {list.map(quiz => (
            <QuizCard
              key={quiz.id}
              quiz={quiz}
              roomId={room.id}
              canManage={canManage(quiz)}
              isMine={!!user && quiz.createdBy === user.id}
              retrying={retryQuiz.isPending && retryQuiz.variables === quiz.id}
              onRetry={() =>
                retryQuiz.mutate(quiz.id, {
                  onSuccess: () => notify("Trying again…", "info"),
                  onError: error => notify(error.message, "error"),
                })
              }
              onDelete={() => setDeleting(quiz)}
            />
          ))}
        </SimpleGrid>
      )}

      <FormModal opened={!!creating} onClose={() => setCreating(null)} title="New quiz" size="lg">
        {creating && (
          <NewQuizForm
            roomId={room.id}
            initialFocus={creating.focus}
            onCancel={() => setCreating(null)}
            onCreated={() => {
              setCreating(null);
              notify("Generating your quiz…", "info");
            }}
            onGoToMaterials={() => {
              setCreating(null);
              setSearchParams({ tab: "materials" }, { replace: true });
            }}
          />
        )}
      </FormModal>

      <Modal opened={!!deleting} onClose={() => setDeleting(null)} title="Delete this quiz?">
        {deleting && <DeleteQuiz roomId={room.id} quiz={deleting} onDone={() => setDeleting(null)} />}
      </Modal>
    </>
  );
}

function DeleteQuiz({ roomId, quiz, onDone }: { roomId: string; quiz: QuizSummary; onDone: () => void }) {
  const deleteQuiz = useDeleteQuiz(roomId);
  return (
    <Stack gap="md">
      {deleteQuiz.isError && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
          {deleteQuiz.error.message}
        </Alert>
      )}
      <Text size="sm">
        <strong>{quiz.title || "This quiz"}</strong> and everyone's attempts and scores on it will be permanently deleted.
      </Text>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onDone}>
          Cancel
        </Button>
        <Button
          color="red"
          loading={deleteQuiz.isPending}
          data-testid="confirm-delete-quiz"
          onClick={() =>
            deleteQuiz.mutate(quiz.id, {
              onSuccess: () => {
                onDone();
                notify(`Deleted "${quiz.title || "quiz"}"`);
              },
            })
          }
        >
          Delete quiz
        </Button>
      </Group>
    </Stack>
  );
}
