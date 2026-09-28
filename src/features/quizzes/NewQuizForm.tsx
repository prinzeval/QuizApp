import { useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  Chip,
  Group,
  Input,
  SegmentedControl,
  Slider,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconAlertCircle, IconSparkles } from "@tabler/icons-react";
import { useCreateQuiz, useMaterials } from "../../hooks/learning.ts";
import { ApiError, type FieldErrors } from "../../lib/api.ts";
import type { Difficulty, QuizSummary, RequestableType } from "../../lib/learningApi.ts";
import { MaterialPicker } from "../materials/MaterialPicker.tsx";
import { COUNT_LIMITS, DEFAULT_TYPES, DIFFICULTIES, DIFFICULTY_LABEL, QUESTION_TYPES, TYPE_LABEL } from "./quizUtils.ts";

interface NewQuizFormProps {
  roomId: string;
  initialFocus?: string;
  onCancel: () => void;
  onCreated: (quiz: QuizSummary) => void;
  onGoToMaterials: () => void;
}

export function NewQuizForm({ roomId, initialFocus = "", onCancel, onCreated, onGoToMaterials }: NewQuizFormProps) {
  const materials = useMaterials(roomId);
  const createQuiz = useCreateQuiz(roomId);

  const [scope, setScope] = useState<"all" | "pick">("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [types, setTypes] = useState<RequestableType[]>([...DEFAULT_TYPES]);
  const [focus, setFocus] = useState(initialFocus.slice(0, 200));
  const [title, setTitle] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const ready = (materials.data?.materials ?? []).filter(m => m.status === "ready");
  const noneReady = materials.isSuccess && ready.length === 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: FieldErrors = {};
    if (types.length === 0) next.questionTypes = "Pick at least one question type";
    if (scope === "pick" && picked.length === 0) next.materialIds = "Choose at least one material, or use all of them";
    setErrors(next);
    if (Object.keys(next).length) return;

    try {
      const { quiz } = await createQuiz.mutateAsync({
        title: title.trim() || undefined,
        materialIds: scope === "pick" ? picked : [],
        questionCount: count,
        difficulty,
        questionTypes: types,
        focus: focus.trim() || undefined,
      });
      onCreated(quiz);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) setErrors(error.fieldErrors);
      else setErrors({ form: error instanceof Error ? error.message : "Couldn't create the quiz. Please try again." });
    }
  };

  const formError = errors.form ?? errors.roomId;

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="lg">
        {formError && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
            {formError}
          </Alert>
        )}

        <MaterialPicker
          materials={materials}
          scope={scope}
          onScopeChange={setScope}
          picked={picked}
          onPickedChange={setPicked}
          error={errors.materialIds}
          description="Questions are written only from these notes."
          onGoToMaterials={onGoToMaterials}
        />

        <Input.Wrapper
          label={
            <>
              Questions: <Text span fw={700} c="var(--mantine-primary-color-filled)">{count}</Text>
            </>
          }
          error={errors.questionCount}
        >
          <Slider
            mt="xs"
            mb="lg"
            min={COUNT_LIMITS.min}
            max={COUNT_LIMITS.max}
            value={count}
            onChange={setCount}
            thumbLabel="Number of questions"
            label={null}
            marks={[5, 10, 15, 20, 25, 30].map(value => ({ value, label: String(value) }))}
            size="md"
            thumbSize={24}
          />
        </Input.Wrapper>

        <Input.Wrapper label="Difficulty" error={errors.difficulty}>
          <SegmentedControl
            mt={6}
            fullWidth
            value={difficulty}
            onChange={value => setDifficulty(value as Difficulty)}
            data={DIFFICULTIES.map(value => ({ value, label: DIFFICULTY_LABEL[value] }))}
            aria-label="Difficulty"
          />
        </Input.Wrapper>

        <Input.Wrapper label="Question types" error={errors.questionTypes} description="Pick at least one.">
          <Chip.Group
            multiple
            value={types}
            onChange={value => {
              setTypes(value as RequestableType[]);
              if (value.length) setErrors(({ questionTypes: _, ...rest }) => rest);
            }}
          >
            <Group gap="xs" mt={8}>
              {QUESTION_TYPES.map(type => (
                <Chip
                  key={type}
                  value={type}
                  size="md"
                  variant="light"
                  data-testid={`type-${type}`}
                >
                  {TYPE_LABEL[type]}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
          {types.includes("picture") && (
            <Text size="xs" c="dimmed" mt={8} data-testid="picture-note">
              Uses the real diagrams and photos from your files: label them, find parts on them, or answer questions about them. The first time,
              the AI looks through each file's pages for pictures, so it can take a minute or two.
            </Text>
          )}
        </Input.Wrapper>

        <TextInput
          label="Focus on"
          description="Optional. Steer questions toward one topic."
          placeholder="e.g. the cardiac cycle"
          value={focus}
          onChange={e => setFocus(e.currentTarget.value)}
          maxLength={200}
          error={errors.focus}
          data-testid="quiz-focus"
        />

        <TextInput
          label="Title"
          description="Optional. We'll name it from your notes if you leave this blank."
          placeholder="e.g. Week 3 review"
          value={title}
          onChange={e => setTitle(e.currentTarget.value)}
          maxLength={200}
          error={errors.title}
          data-testid="quiz-title"
        />

        <Group justify="flex-end" gap="sm" mt="xs">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={createQuiz.isPending}
            disabled={!materials.isSuccess || noneReady}
            leftSection={<IconSparkles size={16} />}
            data-testid="create-quiz"
          >
            Generate quiz
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
