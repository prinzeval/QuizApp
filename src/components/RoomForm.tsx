import { useState, type FormEvent } from "react";
import { ApiError, type FieldErrors, type RoomInput } from "../lib/api.ts";
import { Alert, Button, Group, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";

interface RoomFormProps {
  initial?: RoomInput;
  submitLabel: string;
  onSubmit: (input: RoomInput) => Promise<unknown>;
  onCancel: () => void;
}

export function RoomForm({ initial, submitLabel, onSubmit, onCancel }: RoomFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!name.trim()) {
      setErrors({ name: "Give your room a name" });
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await onSubmit({ name, description });
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) setErrors(error.fieldErrors);
      else setFormError(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        {formError && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
            {formError}
          </Alert>
        )}
        <TextInput
          label="Room name"
          name="name"
          placeholder="e.g. BIO 201 — Human Anatomy"
          value={name}
          onChange={e => setName(e.currentTarget.value)}
          error={errors.name}
          maxLength={100}
          autoComplete="off"
          data-autofocus
        />
        <Textarea
          label={
            <>
              Description{" "}
              <Text span c="dimmed" fw={400} size="sm">
                (optional)
              </Text>
            </>
          }
          name="description"
          autosize
          minRows={3}
          maxRows={6}
          maxLength={500}
          placeholder="What are you studying in here?"
          value={description}
          onChange={e => setDescription(e.currentTarget.value)}
          error={errors.description}
        />
        <Group justify="flex-end" gap="sm" mt="xs">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
