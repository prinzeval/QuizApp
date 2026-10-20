import { Link } from "react-router-dom";
import { ActionIcon, Badge, Button, Card, Group, Loader, Menu, Skeleton, Stack, Text, Title, Tooltip } from "@mantine/core";
import { IconAlertTriangle, IconCards, IconDots, IconEye, IconLock, IconPlayerPlay, IconPlus, IconSparkles, IconTrash } from "@tabler/icons-react";
import type { FlashcardDeck } from "../../lib/flashcardsApi.ts";
import { plural, timeAgo } from "../../lib/format.ts";
import { KIND_LABEL, dueSummary } from "./flashcardUtils.ts";

interface DeckCardProps {
  deck: FlashcardDeck;
  roomId: string;
  isMine: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onBrowse: () => void;
  onAdd: () => void;
  onDelete: () => void;
}

const KIND_COLOR = { ai: "clay", manual: "gray", mistakes: "red" } as const;

export function DeckCard({ deck, roomId, isMine, canEdit, canDelete, onBrowse, onAdd, onDelete }: DeckCardProps) {
  const ready = deck.status === "ready";
  const toStudy = deck.mine.due + deck.mine.new;
  const reviewHref = `/rooms/${roomId}/flashcards/review?deckId=${encodeURIComponent(deck.id)}`;

  return (
    <Card component="li" h="100%" shadow="xs" aria-busy={deck.status === "generating"} data-testid="deck-card" data-status={deck.status}>
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Stack gap={6} miw={0} flex={1}>
          <Group gap={6}>
            <Badge
              size="sm"
              variant="light"
              color={KIND_COLOR[deck.kind]}
              leftSection={deck.kind === "ai" ? <IconSparkles size={11} /> : deck.kind === "mistakes" ? <IconLock size={11} /> : undefined}
            >
              {KIND_LABEL[deck.kind]}
            </Badge>
            {deck.isPrivate && deck.kind !== "mistakes" && (
              <Tooltip label="Only you can see this deck" withArrow>
                <Badge size="sm" variant="light" color="gray" leftSection={<IconLock size={11} />}>
                  Private
                </Badge>
              </Tooltip>
            )}
            {deck.status === "generating" && (
              <Badge size="sm" variant="light" color="clay" leftSection={<Loader size={10} color="clay" aria-hidden="true" />}>
                Writing
              </Badge>
            )}
            {deck.status === "failed" && (
              <Badge size="sm" variant="light" color="red">
                Failed
              </Badge>
            )}
          </Group>
          <Title order={3} lineClamp={2} style={{ overflowWrap: "anywhere" }} data-testid="deck-title">
            {deck.title || "Untitled deck"}
          </Title>
        </Stack>

        {(ready || canDelete) && (
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size={40} aria-label={`More actions for ${deck.title || "deck"}`} data-testid="deck-menu">
                <IconDots size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {ready && (
                <Menu.Item leftSection={<IconEye size={16} />} onClick={onBrowse} data-testid="browse-deck">
                  Browse cards
                </Menu.Item>
              )}
              {ready && canEdit && (
                <Menu.Item leftSection={<IconPlus size={16} />} onClick={onAdd} data-testid="add-card-menu">
                  Add card
                </Menu.Item>
              )}
              {canDelete && (
                <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={onDelete} data-testid="delete-deck">
                  Delete deck
                </Menu.Item>
              )}
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>

      {deck.status === "generating" && (
        <Stack gap={8} mt="md" flex={1} role="status">
          <Text size="sm" c="dimmed">
            Writing flashcards from your notes…{deck.cardCount > 0 ? ` ${plural(deck.cardCount, "card")} so far` : ""}
          </Text>
          <Skeleton h={8} w="88%" radius="xl" />
          <Skeleton h={8} w="64%" radius="xl" />
        </Stack>
      )}

      {deck.status === "failed" && (
        <Group gap={8} wrap="nowrap" align="flex-start" mt="md" flex={1}>
          <IconAlertTriangle size={18} color="var(--mantine-color-red-6)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <Text size="sm" c="dimmed" lineClamp={3}>
            {deck.error || "Something went wrong while writing these cards."}
            {canDelete ? " Delete it and try again." : ""}
          </Text>
        </Group>
      )}

      {ready && (
        <Stack gap={4} mt="sm" flex={1}>
          <Group gap={6} wrap="nowrap">
            <IconCards size={16} stroke={1.7} color="var(--mantine-color-dimmed)" aria-hidden="true" style={{ flexShrink: 0 }} />
            <Text size="sm">
              {plural(deck.cardCount, "card")}
              <Text span size="sm" c={toStudy > 0 ? "var(--mantine-primary-color-filled)" : "dimmed"} fw={toStudy > 0 ? 600 : 400}>
                {" · "}
                {deck.cardCount === 0 ? "empty" : dueSummary(deck.mine)}
              </Text>
            </Text>
          </Group>
          {deck.materials.length > 0 && (
            <Text size="sm" c="dimmed" lineClamp={1} title={deck.materials.map(m => m.title).join(", ")}>
              From {deck.materials.map(m => m.title).join(", ")}
            </Text>
          )}
        </Stack>
      )}

      <Group justify="space-between" align="center" mt="md" gap="sm" wrap="nowrap">
        <Text size="xs" c="dimmed" lineClamp={2} miw={0}>
          {deck.kind === "mistakes" ? "Only you see this" : `${isMine ? "You" : deck.creatorName ?? "Someone"} · ${timeAgo(deck.createdAt)}`}
        </Text>
        {ready &&
          (toStudy > 0 ? (
            <Button component={Link} to={reviewHref} size="sm" leftSection={<IconPlayerPlay size={16} />} style={{ flexShrink: 0 }} data-testid="study-deck">
              Study
            </Button>
          ) : deck.cardCount === 0 && canEdit ? (
            <Button variant="light" size="sm" leftSection={<IconPlus size={16} />} onClick={onAdd} style={{ flexShrink: 0 }}>
              Add cards
            </Button>
          ) : (
            <Button variant="default" size="sm" leftSection={<IconEye size={16} />} onClick={onBrowse} style={{ flexShrink: 0 }}>
              Browse
            </Button>
          ))}
      </Group>
    </Card>
  );
}
