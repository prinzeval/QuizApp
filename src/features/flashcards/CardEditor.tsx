import { useRef, useState, type FormEvent } from "react";
import { Alert, Button, Group, Stack, Text, Textarea } from "@mantine/core";
import { IconAlertCircle, IconCheck, IconPlus } from "@tabler/icons-react";
import { useSaveCard } from "../../hooks/flashcards.ts";
import { ApiError, type FieldErrors } from "../../lib/api.ts";
import type { Flashcard } from "../../lib/flashcardsApi.ts";
import { notify } from "../../notify.ts";
import { CARD_MAX, validateCard, type CardDraft } from "./flashcardUtils.ts";

interface CardEditorProps {
  roomId: string;
  deckId: string;
  /** null: a new card. */
  card: Flashcard | null;
  onCancel: () => void;
  /** After saving an edit (new cards keep the form open for the next one). */
  onSaved: () => void;
}

const emptyDraft: CardDraft = { front: "", back: "", hint: "" };

/** Front, back and an optional hint. Adding keeps the form open so you can write card after card. */
export function CardEditor({ roomId, deckId, card, onCancel, onSaved }: CardEditorProps) {
  const save = useSaveCard(roomId, deckId);
  const [draft, setDraft] = useState<CardDraft>(card ? { front: card.front, back: card.back, hint: card.hint ?? "" } : emptyDraft);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [added, setAdded] = useState(0);
  const frontRef = useRef<HTMLTextAreaElement>(null);

  const set = (field: keyof CardDraft) => (value: string) => {
    setDraft(current => ({ ...current, [field]: value }));
    if (errors[field]) setErrors(({ [field]: _, ...rest }) => rest);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = validateCard(draft);
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await save.mutateAsync({
        cardId: card?.id ?? null,
        input: { front: draft.front.trim(), back: draft.back.trim(), hint: draft.hint.trim() || undefined },
      });
      if (card) {
        notify("Card saved");
        onSaved();
      } else {
        setAdded(n => n + 1);
        setDraft(emptyDraft);
        frontRef.current?.focus();
      }
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) setErrors(error.fieldErrors);
      else setErrors({ form: error instanceof Error ? error.message : "Couldn't save the card. Please try again." });
    }
  };

  const counter = (value: string) => (value.length > CARD_MAX * 0.9 ? `${value.length} / ${CARD_MAX}` : undefined);

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="md">
        {errors.form && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
            {errors.form}
          </Alert>
        )}
        {added > 0 && (
          <Group gap={6} c="teal" role="status">
            <IconCheck size={16} aria-hidden="true" />
            <Text size="sm" fw={500}>
              {added === 1 ? "Card added." : `${added} cards added.`} Write the next one, or press Done.
            </Text>
          </Group>
        )}
        <Textarea
          ref={frontRef}
          label="Front"
          description={counter(draft.front) ?? "The question or prompt."}
          placeholder="e.g. Which nerve is at risk in a fracture of the surgical neck of the humerus?"
          value={draft.front}
          onChange={event => set("front")(event.currentTarget.value)}
          error={errors.front}
          autosize
          minRows={3}
          maxRows={8}
          maxLength={CARD_MAX + 100}
          data-autofocus
          data-testid="card-front-input"
        />
        <Textarea
          label="Back"
          description={counter(draft.back) ?? "The answer."}
          placeholder="e.g. Axillary nerve (C5, C6)"
          value={draft.back}
          onChange={event => set("back")(event.currentTarget.value)}
          error={errors.back}
          autosize
          minRows={3}
          maxRows={8}
          maxLength={CARD_MAX + 100}
          data-testid="card-back-input"
        />
        <Textarea
          label="Hint"
          description={counter(draft.hint) ?? "Optional. A nudge you can peek at before showing the answer."}
          placeholder="e.g. It wraps around the surgical neck"
          value={draft.hint}
          onChange={event => set("hint")(event.currentTarget.value)}
          error={errors.hint}
          autosize
          minRows={1}
          maxRows={4}
          maxLength={CARD_MAX + 100}
          data-testid="card-hint-input"
        />
        <Group justify="flex-end" gap="sm" mt="xs">
          <Button variant="default" onClick={onCancel}>
            {card ? "Cancel" : added > 0 ? "Done" : "Cancel"}
          </Button>
          <Button type="submit" loading={save.isPending} leftSection={card ? <IconCheck size={16} /> : <IconPlus size={16} />} data-testid="save-card">
            {card ? "Save card" : "Add card"}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
