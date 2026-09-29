import { useState, type FormEvent } from "react";
import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  Chip,
  Group,
  Input,
  ScrollArea,
  SegmentedControl,
  Skeleton,
  Slider,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { IconAlertCircle, IconFileText, IconFileTypeDocx, IconFileTypePdf, IconFileTypePpt, IconPhoto, IconSparkles } from "@tabler/icons-react";
import { useCreateQuiz, useMaterials } from "../../hooks/learning.ts";
import { ApiError, type FieldErrors } from "../../lib/api.ts";
import type { Difficulty, MaterialKind, QuestionType, QuizSummary } from "../../lib/learningApi.ts";
import { plural } from "../../lib/format.ts";
import { COUNT_LIMITS, DIFFICULTIES, DIFFICULTY_LABEL, QUESTION_TYPES, TYPE_LABEL } from "./quizUtils.ts";

const KIND_ICON: Record<MaterialKind, typeof IconFileText> = {
  pdf: IconFileTypePdf,
  docx: IconFileTypeDocx,
  pptx: IconFileTypePpt,
  image: IconPhoto,
  text: IconFileText,
};

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
  const [types, setTypes] = useState<QuestionType[]>([...QUESTION_TYPES]);
  const [focus, setFocus] = useState(initialFocus.slice(0, 200));
  const [title, setTitle] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const all = materials.data?.materials ?? [];
  const ready = all.filter(m => m.status === "ready");
  const pending = all.filter(m => m.status === "queued" || m.status === "processing").length;
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

        <Input.Wrapper
          label="Study from"
          error={errors.materialIds}
          description={ready.length > 0 ? "Questions are written only from these notes." : undefined}
        >
          {materials.isPending ? (
            <Skeleton h={36} mt={6} />
          ) : materials.isError ? (
            <Alert color="red" variant="light" mt={6}>
              Couldn't load materials.{" "}
              <Anchor component="button" type="button" size="sm" onClick={() => materials.refetch()}>
                Try again
              </Anchor>
            </Alert>
          ) : noneReady ? (
            <Alert color="clay" variant="light" mt={6} title="No materials ready yet" data-testid="no-materials">
              <Text size="sm">
                {pending > 0
                  ? `${plural(pending, "file")} still processing. You can create a quiz as soon as ${pending === 1 ? "it's" : "they're"} ready.`
                  : "Upload your notes first. Quizzes are written from them."}
              </Text>
              <Anchor component="button" type="button" size="sm" fw={600} mt={6} onClick={onGoToMaterials}>
                Go to Materials →
              </Anchor>
            </Alert>
          ) : (
            <Stack gap="xs" mt={6}>
              <SegmentedControl
                value={scope}
                onChange={value => setScope(value as "all" | "pick")}
                data={[
                  { value: "all", label: `All materials (${ready.length})` },
                  { value: "pick", label: "Choose…" },
                ]}
                fullWidth
              />
              {scope === "pick" && (
                <ScrollArea.Autosize mah={220} type="auto" offsetScrollbars>
                  <Checkbox.Group value={picked} onChange={setPicked} aria-label="Materials">
                    <Stack gap={6}>
                      {ready.map(material => {
                        const Icon = KIND_ICON[material.kind];
                        return (
                          <Checkbox.Card key={material.id} value={material.id} radius="md" p="sm" data-testid="material-choice">
                            <Group wrap="nowrap" gap="sm">
                              <Checkbox.Indicator />
                              <ThemeIcon variant="light" color="gray" size={32} radius="md">
                                <Icon size={18} stroke={1.6} />
                              </ThemeIcon>
                              <div style={{ minWidth: 0 }}>
                                <Text size="sm" fw={500} lineClamp={1} style={{ overflowWrap: "anywhere" }}>
                                  {material.title}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {material.kind.toUpperCase()}
                                  {material.pageCount ? ` · ${plural(material.pageCount, "page")}` : ""}
                                </Text>
                              </div>
                            </Group>
                          </Checkbox.Card>
                        );
                      })}
                    </Stack>
                  </Checkbox.Group>
                </ScrollArea.Autosize>
              )}
              {pending > 0 && (
                <Text size="xs" c="dimmed">
                  {plural(pending, "more file")} still processing. {pending === 1 ? "It" : "They"}'ll show up here when ready.
                </Text>
              )}
            </Stack>
          )}
        </Input.Wrapper>

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
              setTypes(value as QuestionType[]);
              if (value.length) setErrors(({ questionTypes: _, ...rest }) => rest);
            }}
          >
            <Group gap="xs" mt={8}>
              {QUESTION_TYPES.map(type => (
                <Chip key={type} value={type} size="md" variant="light" data-testid={`type-${type}`}>
                  {TYPE_LABEL[type]}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
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
