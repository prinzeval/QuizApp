import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Button, EmptyState, Group, Modal, Paper, SimpleGrid, Skeleton, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconAlertCircle, IconCards, IconCircleCheck, IconFlame, IconPlayerPlay, IconPlus, IconSparkles, IconTargetArrow } from "@tabler/icons-react";
import { useAuth } from "../../auth/AuthContext.tsx";
import { FormModal } from "../../components/FormModal.tsx";
import { useCreateMistakesDeck, useDecks, useDeleteDeck, useFlashcardsLive } from "../../hooks/flashcards.ts";
import type { Room } from "../../lib/api.ts";
import type { FlashcardDeck, TodaySummary } from "../../lib/flashcardsApi.ts";
import { plural } from "../../lib/format.ts";
import { notify } from "../../notify.ts";
import { DeckBrowser } from "./DeckBrowser.tsx";
import { DeckCard } from "./DeckCard.tsx";
import { MakeFlashcardsForm, NewDeckForm } from "./MakeFlashcardsForm.tsx";
import { canDeleteDeck, canEditCards, streakText, todayHeadline } from "./flashcardUtils.ts";
import classes from "./Flashcards.module.css";

type Browsing = { deck: FlashcardDeck; adding: boolean };

/** The room's Flashcards tab: today's reviews, the decks, and making new ones. */
export function FlashcardsTab({ room }: { room: Room }) {
  const { user } = useAuth();
  const decks = useDecks(room.id);
  useFlashcardsLive(room.id);
  const mistakes = useCreateMistakesDeck(room.id);
  const [, setSearchParams] = useSearchParams();
  const [making, setMaking] = useState(false);
  const [naming, setNaming] = useState(false);
  const [browsing, setBrowsing] = useState<Browsing | null>(null);
  const [deleting, setDeleting] = useState<FlashcardDeck | null>(null);

  const list = decks.data?.decks ?? [];
  // Keep the open browser's deck fresh as the list refreshes.
  const browsingDeck = browsing ? list.find(deck => deck.id === browsing.deck.id) ?? browsing.deck : null;

  const goToMaterials = () => {
    setMaking(false);
    setSearchParams({ tab: "materials" }, { replace: true });
  };

  const fromMistakes = () =>
    mistakes.mutate(undefined, {
      onSuccess: ({ added }) =>
        notify(added > 0 ? `Added ${plural(added, "card")} to My mistakes` : "My mistakes is up to date: no new mistakes since last time", added > 0 ? "success" : "info"),
      onError: error => notify(error.message, "info"),
    });

  const actions = (justify?: "center") => (
    <Group gap="xs" justify={justify}>
      <Button leftSection={<IconSparkles size={16} />} onClick={() => setMaking(true)} data-testid="make-flashcards">
        Make flashcards
      </Button>
      <Button variant="default" leftSection={<IconPlus size={16} />} onClick={() => setNaming(true)} data-testid="new-deck">
        New empty deck
      </Button>
      <Button variant="subtle" leftSection={<IconTargetArrow size={16} />} loading={mistakes.isPending} onClick={fromMistakes} data-testid="mistakes-deck">
        From my mistakes
      </Button>
    </Group>
  );

  return (
    <>
      <div>
        <Title order={2}>Flashcards</Title>
        <Text size="sm" c="dimmed" mt={2} mb="lg">
          Spaced repetition: each card comes back just before you'd forget it. Your schedule is your own.
        </Text>
      </div>

      {decks.isPending ? (
        <Stack gap="md" aria-busy="true" aria-label="Loading flashcards">
          <Skeleton h={132} radius="lg" />
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {[0, 1, 2].map(i => (
              <Skeleton key={i} h={180} radius="lg" />
            ))}
          </SimpleGrid>
        </Stack>
      ) : decks.isError ? (
        <EmptyState title="Couldn't load flashcards" description={decks.error.message} py={56} bd="1px dashed var(--mantine-color-default-border)" bdrs="lg">
          <EmptyState.Actions>
            <Button variant="default" onClick={() => decks.refetch()}>
              Try again
            </Button>
          </EmptyState.Actions>
        </EmptyState>
      ) : (
        <>
          {list.length > 0 && <TodayCard roomId={room.id} today={decks.data.today} />}

          <Group justify="space-between" align="center" mt={list.length > 0 ? "xl" : 0} mb="sm" gap="sm">
            {list.length > 0 && (
              <Title order={3} size="h4">
                Decks
              </Title>
            )}
            {list.length > 0 && actions()}
          </Group>

          {list.length === 0 ? (
            <EmptyState
              icon={<IconCards size={40} stroke={1.4} color="var(--mantine-primary-color-filled)" />}
              title="No flashcards yet"
              description="Let the AI write a deck from your notes, start an empty deck and write your own, or turn the questions you got wrong into cards."
              py={56}
              px="md"
              bd="1px dashed var(--mantine-color-default-border)"
              bdrs="lg"
            >
              <EmptyState.Actions>{actions("center")}</EmptyState.Actions>
            </EmptyState>
          ) : (
            <SimpleGrid component="ul" cols={{ base: 1, sm: 2, lg: 3 }} spacing="md" p={0} m={0} style={{ listStyle: "none" }}>
              {list.map(deck => (
                <DeckCard
                  key={deck.id}
                  deck={deck}
                  roomId={room.id}
                  isMine={!!user && deck.createdBy === user.id}
                  canEdit={canEditCards(deck, user?.id, room.role)}
                  canDelete={canDeleteDeck(deck, user?.id, room.role)}
                  onBrowse={() => setBrowsing({ deck, adding: false })}
                  onAdd={() => setBrowsing({ deck, adding: true })}
                  onDelete={() => setDeleting(deck)}
                />
              ))}
            </SimpleGrid>
          )}
        </>
      )}

      <FormModal opened={making} onClose={() => setMaking(false)} title="Make flashcards" size="lg">
        {making && (
          <MakeFlashcardsForm
            roomId={room.id}
            onCancel={() => setMaking(false)}
            onCreated={() => {
              setMaking(false);
              notify("Writing your flashcards…", "info");
            }}
            onGoToMaterials={goToMaterials}
          />
        )}
      </FormModal>

      <FormModal opened={naming} onClose={() => setNaming(false)} title="New empty deck">
        {naming && (
          <NewDeckForm
            roomId={room.id}
            onCancel={() => setNaming(false)}
            onCreated={deck => {
              setNaming(false);
              // Straight into writing the first card.
              setBrowsing({ deck, adding: true });
            }}
          />
        )}
      </FormModal>

      <FormModal opened={!!browsingDeck} onClose={() => setBrowsing(null)} title={browsingDeck?.title || "Deck"} size="xl">
        {browsing && browsingDeck && (
          <DeckBrowser
            key={`${browsingDeck.id}-${browsing.adding}`}
            roomId={room.id}
            deck={browsingDeck}
            canEdit={canEditCards(browsingDeck, user?.id, room.role)}
            startAdding={browsing.adding}
            onClose={() => setBrowsing(null)}
          />
        )}
      </FormModal>

      <Modal opened={!!deleting} onClose={() => setDeleting(null)} title="Delete this deck?">
        {deleting && <DeleteDeck roomId={room.id} deck={deleting} onDone={() => setDeleting(null)} />}
      </Modal>
    </>
  );
}

function TodayCard({ roomId, today }: { roomId: string; today: TodaySummary }) {
  const headline = todayHeadline(today);
  const streak = streakText(today.streakDays);

  return (
    <Paper withBorder p={{ base: "md", sm: "lg" }} className={classes.today} data-testid="flashcards-today">
      <Group justify="space-between" align="center" gap="md">
        <Group gap="md" wrap="nowrap" miw={0} align="center">
          <ThemeIcon size={48} radius="xl" variant="light" color={headline.hasWork ? "clay" : "teal"} style={{ flexShrink: 0 }}>
            {headline.hasWork ? <IconCards size={26} stroke={1.6} /> : <IconCircleCheck size={26} stroke={1.6} />}
          </ThemeIcon>
          <div style={{ minWidth: 0 }}>
            <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: "0.04em" }}>
              Today
            </Text>
            <Text fw={600} fz={{ base: "1.25rem", sm: "1.5rem" }} ff="var(--mantine-font-family-headings)" lh={1.3} data-testid="today-headline">
              {headline.title}
            </Text>
            <Group gap="xs" mt={2}>
              {streak && (
                <Group gap={4} wrap="nowrap" c="orange.7" data-testid="streak">
                  <IconFlame size={16} stroke={1.8} aria-hidden="true" />
                  <Text size="sm" fw={600} inherit>
                    {streak}
                  </Text>
                </Group>
              )}
              {headline.detail && (
                <Text size="sm" c="dimmed">
                  {headline.detail}
                </Text>
              )}
            </Group>
          </div>
        </Group>
        {headline.hasWork ? (
          <Button
            component={Link}
            to={`/rooms/${roomId}/flashcards/review`}
            size="md"
            leftSection={<IconPlayerPlay size={18} />}
            w={{ base: "100%", xs: "auto" }}
            data-testid="start-review"
          >
            Start review
          </Button>
        ) : (
          <Button size="md" disabled w={{ base: "100%", xs: "auto" }} data-testid="start-review">
            Nothing to review
          </Button>
        )}
      </Group>
    </Paper>
  );
}

function DeleteDeck({ roomId, deck, onDone }: { roomId: string; deck: FlashcardDeck; onDone: () => void }) {
  const remove = useDeleteDeck(roomId);
  return (
    <Stack gap="md">
      {remove.isError && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
          {remove.error.message}
        </Alert>
      )}
      <Text size="sm">
        <strong>{deck.title || "This deck"}</strong>
        {deck.isPrivate
          ? " and your review history on it will be permanently deleted."
          : ` and its ${plural(deck.cardCount, "card")} will be deleted for everyone in the room, along with their review history.`}
      </Text>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onDone}>
          Cancel
        </Button>
        <Button
          color="red"
          loading={remove.isPending}
          data-testid="confirm-delete-deck"
          onClick={() =>
            remove.mutate(deck.id, {
              onSuccess: () => {
                onDone();
                notify(`Deleted "${deck.title || "deck"}"`);
              },
            })
          }
        >
          Delete deck
        </Button>
      </Group>
    </Stack>
  );
}
