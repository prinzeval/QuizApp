import { useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  CloseButton,
  EmptyState,
  Group,
  Modal,
  Paper,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { IconAlertCircle, IconArrowLeft, IconPencil, IconPlus, IconSearch, IconTrash } from "@tabler/icons-react";
import { useDeck, useDeleteCard } from "../../hooks/flashcards.ts";
import type { Flashcard, FlashcardDeck } from "../../lib/flashcardsApi.ts";
import { plural } from "../../lib/format.ts";
import { notify } from "../../notify.ts";
import { CardEditor } from "./CardEditor.tsx";
import { STATUS_COLOR, STATUS_LABEL, cardMatches, dueText } from "./flashcardUtils.ts";
import classes from "./Flashcards.module.css";

const PAGE = 100;

type View = { kind: "list" } | { kind: "edit"; card: Flashcard | null };

interface DeckBrowserProps {
  roomId: string;
  deck: FlashcardDeck;
  canEdit: boolean;
  /** Open straight on a new card ("Add card" in the deck's menu). */
  startAdding?: boolean;
  onClose: () => void;
}

/** Every card in a deck, searchable, with add / edit / delete for those who can. */
export function DeckBrowser({ roomId, deck, canEdit, startAdding = false, onClose }: DeckBrowserProps) {
  const detail = useDeck(roomId, deck.id);
  const [view, setView] = useState<View>(startAdding && canEdit ? { kind: "edit", card: null } : { kind: "list" });
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [deleting, setDeleting] = useState<Flashcard | null>(null);

  const cards = detail.data?.cards;
  const matches = useMemo(() => (cards ?? []).filter(card => cardMatches(card, query)), [cards, query]);

  if (view.kind === "edit") {
    // Opened from the menu straight on "add": closing goes back out, not to the list.
    const back = () => (startAdding && !view.card ? onClose() : setView({ kind: "list" }));
    return (
      <Stack gap="md">
        {!(startAdding && !view.card) && (
          <Button variant="subtle" color="gray" size="sm" px={8} ml={-8} w="fit-content" leftSection={<IconArrowLeft size={14} />} onClick={back}>
            All cards
          </Button>
        )}
        <Text fw={600}>{view.card ? "Edit card" : `New card in ${deck.title}`}</Text>
        <CardEditor key={view.card?.id ?? "new"} roomId={roomId} deckId={deck.id} card={view.card} onCancel={back} onSaved={back} />
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Group gap="sm" wrap="nowrap">
        <TextInput
          flex={1}
          placeholder="Search cards"
          aria-label="Search cards"
          leftSection={<IconSearch size={16} />}
          rightSection={query ? <CloseButton size="sm" aria-label="Clear search" onClick={() => setQuery("")} /> : null}
          value={query}
          onChange={event => {
            setQuery(event.currentTarget.value);
            setShown(PAGE);
          }}
          data-testid="card-search"
        />
        {canEdit && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => setView({ kind: "edit", card: null })} style={{ flexShrink: 0 }} data-testid="add-card">
            Add card
          </Button>
        )}
      </Group>

      {detail.isPending ? (
        <Stack gap="xs" aria-busy="true" aria-label="Loading cards">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} h={68} radius="md" />
          ))}
        </Stack>
      ) : detail.isError ? (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title="Couldn't load the cards">
          <Text size="sm">{detail.error.message}</Text>
          <Button size="xs" variant="light" color="red" mt="xs" onClick={() => detail.refetch()}>
            Try again
          </Button>
        </Alert>
      ) : detail.data.cards.length === 0 ? (
        <EmptyState
          title="No cards yet"
          description={canEdit ? "Write your first card: a question on the front, the answer on the back." : "Nothing in this deck yet."}
          py={40}
          bd="1px dashed var(--mantine-color-default-border)"
          bdrs="lg"
        >
          {canEdit && (
            <EmptyState.Actions>
              <Button leftSection={<IconPlus size={16} />} onClick={() => setView({ kind: "edit", card: null })}>
                Add card
              </Button>
            </EmptyState.Actions>
          )}
        </EmptyState>
      ) : (
        <>
          <Text size="xs" c="dimmed" aria-live="polite">
            {query ? `${plural(matches.length, "card")} match` : plural(detail.data.cards.length, "card")}
          </Text>
          {matches.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="lg">
              No cards match "{query}".
            </Text>
          ) : (
            <Paper withBorder radius="lg" component="ul" p={0} m={0} style={{ listStyle: "none", overflow: "hidden" }}>
              {matches.slice(0, shown).map((card, index) => (
                <CardRow
                  key={card.id}
                  card={card}
                  first={index === 0}
                  canEdit={canEdit}
                  onEdit={() => setView({ kind: "edit", card })}
                  onDelete={() => setDeleting(card)}
                />
              ))}
            </Paper>
          )}
          {matches.length > shown && (
            <Button variant="default" onClick={() => setShown(n => n + PAGE)}>
              Show more ({matches.length - shown} left)
            </Button>
          )}
        </>
      )}

      <Modal opened={!!deleting} onClose={() => setDeleting(null)} title="Delete this card?">
        {deleting && <DeleteCard roomId={roomId} deckId={deck.id} card={deleting} onDone={() => setDeleting(null)} />}
      </Modal>
    </Stack>
  );
}

function CardRow({ card, first, canEdit, onEdit, onDelete }: { card: Flashcard; first: boolean; canEdit: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <Group
      component="li"
      wrap="nowrap"
      gap="sm"
      px="md"
      py="sm"
      align="flex-start"
      className={classes.row}
      style={{ borderTop: first ? undefined : "1px solid var(--mantine-color-default-border)" }}
      data-testid="card-row"
    >
      <Stack gap={4} miw={0} flex={1}>
        <Text size="sm" fw={600} lineClamp={2} style={{ overflowWrap: "anywhere", whiteSpace: "pre-line" }}>
          {card.front}
        </Text>
        <Text size="sm" c="dimmed" lineClamp={1} style={{ overflowWrap: "anywhere" }}>
          {card.back}
        </Text>
        <Group gap={6} mt={2}>
          <Badge size="xs" variant="light" color={STATUS_COLOR[card.state.status]}>
            {STATUS_LABEL[card.state.status]}
          </Badge>
          {card.state.status !== "new" && (
            <Text size="xs" c="dimmed">
              {dueText(card.state)}
            </Text>
          )}
          {card.source?.materialTitle && (
            <Text size="xs" c="dimmed" lineClamp={1} miw={0} style={{ flex: "1 1 120px" }}>
              · {card.source.materialTitle}
            </Text>
          )}
        </Group>
      </Stack>
      {canEdit && (
        <Group gap={0} wrap="nowrap" style={{ flexShrink: 0 }}>
          <Tooltip label="Edit" withArrow>
            <ActionIcon variant="subtle" color="gray" size={40} onClick={onEdit} aria-label="Edit card" data-testid="edit-card">
              <IconPencil size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete" withArrow>
            <ActionIcon variant="subtle" color="gray" size={40} onClick={onDelete} aria-label="Delete card" data-testid="delete-card">
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      )}
    </Group>
  );
}

function DeleteCard({ roomId, deckId, card, onDone }: { roomId: string; deckId: string; card: Flashcard; onDone: () => void }) {
  const remove = useDeleteCard(roomId, deckId);
  return (
    <Stack gap="md">
      {remove.isError && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
          {remove.error.message}
        </Alert>
      )}
      <Text size="sm" lineClamp={3} style={{ overflowWrap: "anywhere" }}>
        <strong>{card.front}</strong>
      </Text>
      <Text size="sm" c="dimmed">
        The card and everyone's review history on it will be deleted.
      </Text>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onDone}>
          Cancel
        </Button>
        <Button
          color="red"
          loading={remove.isPending}
          data-testid="confirm-delete-card"
          onClick={() =>
            remove.mutate(card.id, {
              onSuccess: () => {
                onDone();
                notify("Card deleted");
              },
            })
          }
        >
          Delete card
        </Button>
      </Group>
    </Stack>
  );
}
