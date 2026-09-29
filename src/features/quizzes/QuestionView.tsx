import { useId, type ReactNode, type Ref } from "react";
import { Badge, Box, Group, Radio, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Title } from "@mantine/core";
import { IconCheck, IconX } from "@tabler/icons-react";
import type { QuestionReview, QuizQuestion } from "../../lib/learningApi.ts";
import { OPTION_LETTERS, TYPE_LABEL, splitBlank } from "./quizUtils.ts";
import classes from "./Option.module.css";

interface QuestionViewProps {
  question: QuizQuestion;
  /** Current response: an option index as a string, the typed text, or "" for none. */
  value: string;
  onChange: (value: string) => void;
  /** Enter in the fill-in-the-blank box. */
  onSubmit?: () => void;
  /** Revealed answer (practice mode, after checking). Locks the question. */
  review?: QuestionReview | null;
  disabled?: boolean;
  headingRef?: Ref<HTMLHeadingElement>;
  inputRef?: Ref<HTMLInputElement>;
}

/** One question: prompt plus the right answer control for its type. */
export function QuestionView({ question, value, onChange, onSubmit, review, disabled, headingRef, inputRef }: QuestionViewProps) {
  const promptId = useId();
  const locked = !!review || !!disabled;

  return (
    <Stack gap="lg">
      <Group gap={6}>
        {question.topic && (
          <Badge variant="light" color="gray" size="md" radius="sm" tt="none" fw={600} maw="100%">
            {question.topic}
          </Badge>
        )}
        <Text size="xs" c="dimmed" fw={500}>
          {TYPE_LABEL[question.type]}
        </Text>
      </Group>

      <Title
        order={2}
        id={promptId}
        ref={headingRef}
        tabIndex={-1}
        fz={{ base: "1.25rem", sm: "1.5rem" }}
        lh={1.4}
        fw={600}
        style={{ outline: "none", overflowWrap: "anywhere" }}
        data-testid="question-prompt"
      >
        {question.type === "fill_blank" ? <BlankPrompt prompt={question.prompt} value={value} review={review ?? null} /> : question.prompt}
      </Title>

      {question.type === "fill_blank" ? (
        <TextInput
          ref={inputRef}
          size="lg"
          aria-labelledby={promptId}
          placeholder="Type your answer"
          value={value}
          onChange={event => onChange(event.currentTarget.value)}
          onKeyDown={event => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              onSubmit?.();
            }
          }}
          readOnly={locked}
          maxLength={200}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
          data-testid="answer-input"
          styles={
            review
              ? { input: { borderColor: `var(--mantine-color-${review.isCorrect ? "teal" : "red"}-6)`, borderWidth: 2 } }
              : undefined
          }
          rightSection={review ? <VerdictIcon correct={!!review.isCorrect} /> : null}
        />
      ) : (
        <Radio.Group value={value === "" ? null : value} onChange={next => !locked && onChange(next)} aria-labelledby={promptId} readOnly={locked}>
          {question.type === "true_false" ? (
            <SimpleGrid cols={2} spacing="sm">
              {(question.options ?? ["True", "False"]).map((option, index) => (
                <OptionCard
                  key={index}
                  index={index}
                  value={value}
                  review={review ?? null}
                  disabled={locked}
                  shortcut={index === 0 ? "T" : "F"}
                >
                  <Stack gap={6} align="center" py={{ base: "sm", sm: "md" }}>
                    {index === 0 ? <IconCheck size={26} stroke={2} aria-hidden="true" /> : <IconX size={26} stroke={2} aria-hidden="true" />}
                    <Text fw={600} size="lg">
                      {option}
                    </Text>
                  </Stack>
                </OptionCard>
              ))}
            </SimpleGrid>
          ) : (
            <Stack gap="sm">
              {(question.options ?? []).map((option, index) => (
                <OptionCard key={index} index={index} value={value} review={review ?? null} disabled={locked} shortcut={OPTION_LETTERS[index]}>
                  <Group wrap="nowrap" gap="md" align="center">
                    <ThemeIcon
                      size={32}
                      radius="md"
                      variant={value === String(index) && !review ? "filled" : "default"}
                      style={{ flexShrink: 0, fontWeight: 700, fontSize: 14 }}
                      aria-hidden="true"
                    >
                      {OPTION_LETTERS[index]}
                    </ThemeIcon>
                    <Text size="md" style={{ overflowWrap: "anywhere" }} flex={1}>
                      {option}
                    </Text>
                    <RevealIcon index={index} value={value} review={review ?? null} />
                  </Group>
                </OptionCard>
              ))}
            </Stack>
          )}
        </Radio.Group>
      )}
    </Stack>
  );
}

function optionState(index: number, value: string, review: QuestionReview | null): "correct" | "wrong" | "dim" | undefined {
  if (!review) return undefined;
  if (review.correctIndex === index) return "correct";
  if (value === String(index)) return "wrong";
  return "dim";
}

function OptionCard({
  index,
  value,
  review,
  disabled,
  shortcut,
  children,
}: {
  index: number;
  value: string;
  review: QuestionReview | null;
  disabled: boolean;
  shortcut?: string;
  children: ReactNode;
}) {
  const checked = value === String(index);
  // Roving focus: only the selected (or first) option is in the tab order; arrows move between them.
  const tabbable = checked || (value === "" && index === 0);
  return (
    <Radio.Card
      value={String(index)}
      className={classes.option}
      radius="md"
      p="md"
      mih={56}
      tabIndex={tabbable ? 0 : -1}
      disabled={disabled}
      aria-keyshortcuts={shortcut}
      mod={{ state: optionState(index, value, review) }}
      data-testid="option"
    >
      {children}
    </Radio.Card>
  );
}

function RevealIcon({ index, value, review }: { index: number; value: string; review: QuestionReview | null }) {
  const state = optionState(index, value, review);
  if (state === "correct") return <VerdictIcon correct label="Correct answer" />;
  if (state === "wrong") return <VerdictIcon correct={false} label="Your answer" />;
  return null;
}

function VerdictIcon({ correct, label }: { correct: boolean; label?: string }) {
  return (
    <ThemeIcon size={26} radius="xl" color={correct ? "teal" : "red"} style={{ flexShrink: 0 }} aria-label={label} role={label ? "img" : undefined}>
      {correct ? <IconCheck size={16} stroke={3} /> : <IconX size={16} stroke={3} />}
    </ThemeIcon>
  );
}

/** The prompt with its blank drawn in, showing what's typed (or the right answer once revealed). */
export function BlankPrompt({ prompt, value, review }: { prompt: string; value: string; review: QuestionReview | null }) {
  const { before, after, hasBlank } = splitBlank(prompt);
  if (!hasBlank) return <>{prompt}</>;
  const shown = value.trim();
  const color = review ? (review.isCorrect ? "var(--mantine-color-teal-7)" : "var(--mantine-color-red-7)") : "var(--mantine-primary-color-filled)";
  return (
    <>
      {before}
      <Box
        component="span"
        aria-label={shown ? `blank, filled with ${shown}` : "blank"}
        style={{
          display: "inline-block",
          minWidth: "4.5em",
          padding: "0 0.25em",
          borderBottom: `2px solid ${shown ? color : "var(--mantine-color-default-border)"}`,
          color,
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        {shown || " "}
      </Box>
      {after}
    </>
  );
}
