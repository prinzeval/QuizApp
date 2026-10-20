import { useState, type FormEvent } from "react";
import { Alert, Button, Group, Input, Slider, Stack, Text, TextInput } from "@mantine/core";
import { IconAlertCircle, IconCards, IconSparkles } from "@tabler/icons-react";
import { useMaterials } from "../../hooks/learning.ts";
import { useCreateAiDeck, useCreateManualDeck } from "../../hooks/flashcards.ts";
import { ApiError, type FieldErrors } from "../../lib/api.ts";
import type { FlashcardDeck } from "../../lib/flashcardsApi.ts";
import { MaterialPicker } from "../materials/MaterialPicker.tsx";

export const AI_COUNT = { min: 10, max: 60, default: 20 } as const;

interface MakeFlashcardsFormProps {
  roomId: string;
  onCancel: () => void;
  onCreated: (deck: FlashcardDeck) => void;
  onGoToMaterials: () => void;
}

/** "Make flashcards": the AI writes a deck from the chosen notes. */
export function MakeFlashcardsForm({ roomId, onCancel, onCreated, onGoToMaterials }: MakeFlashcardsFormProps) {
  const materials = useMaterials(roomId);
  const create = useCreateAiDeck(roomId);
  const [scope, setScope] = useState<"all" | "pick">("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [count, setCount] = useState<number>(AI_COUNT.default);
  const [focus, setFocus] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const noneReady = materials.isSuccess && !materials.data.materials.some(m => m.status === "ready");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (scope === "pick" && picked.length === 0) return setErrors({ materialIds: "Choose at least one file, or use all of them" });
    setErrors({});
    try {
      const { deck } = await create.mutateAsync({ materialIds: scope === "pick" ? picked : [], count, focus: focus.trim() || undefined });
      onCreated(deck);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) setErrors(error.fieldErrors);
      else setErrors({ form: error instanceof Error ? error.message : "Couldn't start. Please try again." });
    }
  };

  const formError = errors.form ?? errors.kind;

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="lg">
        {formError && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
            {formError}
          </Alert>
        )}
        <Text size="sm">
          The AI picks out the facts worth remembering and writes one question per card, with the answer on the back and a link to where it came from.
        </Text>
        <MaterialPicker
          materials={materials}
          scope={scope}
          onScopeChange={setScope}
          picked={picked}
          onPickedChange={setPicked}
          error={errors.materialIds}
          description="Cards are written only from these files."
          onGoToMaterials={onGoToMaterials}
        />
        <Input.Wrapper
          label={
            <>
              Cards: <Text span fw={700} c="var(--mantine-primary-color-filled)">{count}</Text>
            </>
          }
          error={errors.count}
        >
          <Slider
            mt="xs"
            mb="lg"
            min={AI_COUNT.min}
            max={AI_COUNT.max}
            step={5}
            value={count}
            onChange={setCount}
            thumbLabel="Number of cards"
            label={null}
            marks={[10, 20, 30, 40, 50, 60].map(value => ({ value, label: String(value) }))}
            size="md"
            thumbSize={24}
          />
        </Input.Wrapper>
        <TextInput
          label="Focus on"
          description="Optional. Steer the cards toward one topic."
          placeholder="e.g. brachial plexus branches"
          value={focus}
          onChange={event => setFocus(event.currentTarget.value)}
          maxLength={200}
          error={errors.focus}
          data-testid="flashcards-focus"
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={create.isPending}
            disabled={!materials.isSuccess || noneReady}
            leftSection={<IconSparkles size={16} />}
            data-testid="make-flashcards-submit"
          >
            Make flashcards
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/** "New empty deck": a manual deck you fill in yourself. */
export function NewDeckForm({ roomId, onCancel, onCreated }: { roomId: string; onCancel: () => void; onCreated: (deck: FlashcardDeck) => void }) {
  const create = useCreateManualDeck(roomId);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return setError("Give the deck a name");
    setError(null);
    try {
      const { deck } = await create.mutateAsync(trimmed);
      onCreated(deck);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.fieldErrors.title ?? caught.message : "Couldn't create the deck. Please try again.");
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="lg">
        <TextInput
          label="Deck name"
          placeholder="e.g. Cranial nerves"
          value={title}
          onChange={event => setTitle(event.currentTarget.value)}
          maxLength={200}
          error={error}
          data-autofocus
          data-testid="deck-title"
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending} leftSection={<IconCards size={16} />} data-testid="create-deck">
            Create deck
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
