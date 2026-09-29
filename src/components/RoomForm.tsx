import { useState, type FormEvent } from "react";
import { ApiError, type FieldErrors, type RoomInput } from "../lib/api.ts";
import { FormAlert, TextField } from "./fields.tsx";

interface RoomFormProps {
  initial?: RoomInput;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (input: RoomInput) => Promise<unknown>;
  onCancel: () => void;
}

export function RoomForm({ initial, submitLabel, pendingLabel, onSubmit, onCancel }: RoomFormProps) {
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
    <form className="stack" onSubmit={handleSubmit} noValidate>
      {formError && <FormAlert>{formError}</FormAlert>}
      <TextField
        label="Room name"
        name="name"
        placeholder="e.g. BIO 201 — Human Anatomy"
        value={name}
        onChange={e => setName(e.target.value)}
        error={errors.name}
        maxLength={100}
        autoComplete="off"
        autoFocus
      />
      <div className={`field ${errors.description ? "field-invalid" : ""}`}>
        <label className="field-label" htmlFor="room-description">
          Description <span className="field-optional">(optional)</span>
        </label>
        <textarea
          id="room-description"
          className="field-input field-textarea"
          name="description"
          rows={3}
          maxLength={500}
          placeholder="What are you studying in here?"
          value={description}
          onChange={e => setDescription(e.target.value)}
          aria-invalid={errors.description ? true : undefined}
        />
        {errors.description && <p className="field-error">{errors.description}</p>}
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>
          {pending && <span className="spinner" aria-hidden="true" />}
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
