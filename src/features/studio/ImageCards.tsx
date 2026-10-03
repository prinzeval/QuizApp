import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Anchor, Badge, Box, Button, Card, EmptyState, Group, Kbd, SegmentedControl, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { useWindowEvent } from "@mantine/hooks";
import { IconArrowLeft, IconArrowRight, IconCheck, IconEye, IconExternalLink, IconPhotoOff, IconRotate, IconX } from "@tabler/icons-react";
import type { Figure, QuestionFigure } from "../../lib/learningApi.ts";
import { viewerPath } from "../materials/paths.ts";
import { FigureCrop, FigureModal } from "../figures/FigureCrop.tsx";
import { AiLabelsNote, LabelImage, figureMasks, parsePlacement, zoneStyle } from "../quizzes/PictureQuestion.tsx";
import classes from "../figures/Figure.module.css";

const MAX_HEIGHT = 460;

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
};

const masksOf = figureMasks;
const canLabel = (figure: Figure) => figure.labels.length >= 2;

/** What the front of a card asks. */
const promptOf = (figure: Figure) =>
  figure.kind === "group" ? "Which caption goes with which picture?" : figure.labels.length >= 2 ? "Can you name the labelled parts?" : "What does this show?";

/**
 * A deck of flip cards made from the real figures in the room's files. The
 * front covers the captions and labels; the back shows them with what the
 * picture teaches. Labelled figures can also be practised by dragging labels.
 */
export function ImageCards({ roomId, figures, growing = false }: { roomId: string; figures: Figure[]; growing?: boolean }) {
  // New cards can arrive while you study: keep your place by card, not by number.
  const [currentId, setCurrentId] = useState<string | null>(null);
  const found = figures.findIndex(entry => entry.id === currentId);
  const index = found === -1 ? 0 : found;
  const setIndex = (next: number) => setCurrentId(figures[next]?.id ?? null);
  const [flipped, setFlipped] = useState(false);
  const [mode, setMode] = useState<"flip" | "label">("flip");
  const [enlarged, setEnlarged] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const figure = figures[index];

  const go = (to: number) => {
    if (to < 0 || to >= figures.length) return;
    setIndex(to);
    setFlipped(false);
    setMode("flip");
  };

  useWindowEvent("keydown", event => {
    const target = event.target as HTMLElement;
    if (enlarged || target.closest("input, textarea, [role='dialog'], [contenteditable='true']")) return;
    if (event.key === "ArrowRight") go(index + 1);
    else if (event.key === "ArrowLeft") go(index - 1);
    else if ((event.key === " " || event.key === "Enter") && mode === "flip" && !target.closest("button, a")) {
      event.preventDefault();
      setFlipped(value => !value);
    }
  });

  if (!figure) {
    return (
      <EmptyState
        icon={<IconPhotoOff size={40} stroke={1.4} color="var(--mantine-color-dimmed)" />}
        title="No pictures found"
        description="These files don't have diagrams or photos worth studying (logos and decoration are skipped). Try other files."
        py={56}
        bd="1px dashed var(--mantine-color-default-border)"
        bdrs="lg"
      />
    );
  }

  const location = figure.page ? `Page ${figure.page}` : figure.location;

  return (
    <Stack gap="md" w="100%" maw={880} mx="auto">
      <Group justify="space-between" gap="sm" wrap="nowrap">
        <Text size="sm" c="dimmed" data-testid="card-counter">
          Card {index + 1} of {figures.length}
          {growing ? " · more coming" : ""}
        </Text>
        {canLabel(figure) && (
          <SegmentedControl
            size="xs"
            value={mode}
            onChange={value => {
              setMode(value as "flip" | "label");
              setFlipped(false);
            }}
            data={[
              { value: "flip", label: "Flip card" },
              { value: "label", label: "Label it" },
            ]}
            aria-label="How to study this card"
          />
        )}
      </Group>

      <Card
        padding={0}
        radius="lg"
        withBorder
        data-testid="image-card"
        data-flipped={flipped}
        onTouchStart={event => (touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY })}
        onTouchEnd={event => {
          const start = touch.current;
          touch.current = null;
          if (!start || mode === "label") return;
          const dx = event.changedTouches[0].clientX - start.x;
          const dy = event.changedTouches[0].clientY - start.y;
          // A clear sideways swipe changes card; anything else is ignored.
          if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) go(index + (dx < 0 ? 1 : -1));
        }}
      >
        <Box p={{ base: "sm", sm: "lg" }} bg="var(--mantine-color-default-hover)" style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
          {mode === "label" ? (
            <LabelPractice key={figure.id} roomId={roomId} figure={figure} />
          ) : (
            <FigureCrop
              key={figure.id}
              roomId={roomId}
              figure={figure}
              masks={flipped ? [] : masksOf(figure)}
              maxHeight={MAX_HEIGHT}
              enlargeable
              onEnlarge={() => setEnlarged(true)}
              label={flipped ? figure.title : `${promptOf(figure)} The labels are covered.`}
              overlay={({ place }) =>
                flipped
                  ? figure.labels.map((label, labelIndex) => (
                      <div key={labelIndex} className={classes.zone} style={zoneStyle(place, label.textBox, figure.aiLabels)} data-state="correct" title={label.text}>
                        <span className={classes.zoneText}>{label.text}</span>
                      </div>
                    ))
                  : null
              }
            />
          )}
        </Box>

        <Stack gap="sm" p={{ base: "md", sm: "lg" }}>
          {mode === "flip" && !flipped && (
            <Stack gap="sm" align="center" py="xs">
              <Title order={3} ta="center" size="h4">
                {promptOf(figure)}
              </Title>
              <Button leftSection={<IconEye size={16} />} onClick={() => setFlipped(true)} data-testid="reveal-card">
                Show answer
              </Button>
              <Text size="xs" c="dimmed" visibleFrom="sm">
                <Kbd size="xs">Space</Kbd> to flip · <Kbd size="xs">←</Kbd> <Kbd size="xs">→</Kbd> to move
              </Text>
            </Stack>
          )}

          {(flipped || mode === "label") && (
            <Stack gap="xs" data-testid="card-answer">
              <Group gap={6}>
                <Badge variant="light" color="gray" tt="none" radius="sm">
                  {figure.kind === "group" ? "Pictures" : figure.kind[0].toUpperCase() + figure.kind.slice(1)}
                </Badge>
                {figure.aiLabels && mode === "flip" && <AiLabelsNote />}
              </Group>
              <Title order={3} size="h4" style={{ overflowWrap: "anywhere" }}>
                {figure.caption ?? figure.title}
              </Title>
              {figure.caption && figure.caption !== figure.title && (
                <Text size="sm" c="dimmed">
                  {figure.title}
                </Text>
              )}
              <Text size="sm" style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
                {figure.description}
              </Text>
            </Stack>
          )}

          <Group justify="space-between" gap="xs" mt="xs" wrap="nowrap">
            <Anchor component={Link} to={viewerPath(roomId, figure.materialId, figure.page)} size="xs" c="dimmed" lineClamp={1} miw={0}>
              <IconExternalLink size={12} style={{ verticalAlign: -1, marginRight: 4 }} aria-hidden="true" />
              {figure.materialTitle}
              {location ? ` · ${location}` : ""}
            </Anchor>
            {flipped && mode === "flip" && (
              <Button variant="subtle" size="xs" color="gray" leftSection={<IconRotate size={14} />} onClick={() => setFlipped(false)}>
                Hide answer
              </Button>
            )}
          </Group>
        </Stack>
      </Card>

      <Group justify="space-between">
        <Button variant="default" leftSection={<IconArrowLeft size={16} />} onClick={() => go(index - 1)} disabled={index === 0} data-testid="prev-card">
          Previous
        </Button>
        <Button
          variant={flipped || mode === "label" ? "filled" : "default"}
          rightSection={<IconArrowRight size={16} />}
          onClick={() => go(index + 1)}
          disabled={index === figures.length - 1}
          data-testid="next-card"
        >
          Next
        </Button>
      </Group>

      <FigureModal opened={enlarged} onClose={() => setEnlarged(false)} title={flipped ? figure.title : "Picture"}>
        <FigureCrop roomId={roomId} figure={figure} masks={flipped ? [] : masksOf(figure)} label={figure.title} />
      </FigureModal>
    </Stack>
  );
}

/** "Label it": drag the (shuffled) labels onto the spots, then check. Answers are known here, so it's all local. */
function LabelPractice({ roomId, figure }: { roomId: string; figure: Figure }) {
  const [attempt, setAttempt] = useState(0);
  const options = useMemo(() => shuffle(figure.labels.map(label => label.text)), [figure, attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setValue("");
    setChecked(false);
  }, [attempt]);

  const question: QuestionFigure = { ...figure, masks: masksOf(figure), zones: figure.labels.map(label => label.textBox) };
  const placed = parsePlacement(value, figure.labels.length);
  const complete = placed.every(entry => entry !== null);
  const right = placed.map((option, index) => option !== null && options[option] === figure.labels[index].text);
  const score = right.filter(Boolean).length;

  if (checked) {
    return (
      <Stack gap="sm" data-testid="label-practice-result">
        <FigureCrop
          roomId={roomId}
          figure={figure}
          masks={masksOf(figure)}
          maxHeight={MAX_HEIGHT}
          label={`${figure.title}: ${score} of ${figure.labels.length} labels right`}
          overlay={({ place }) =>
            figure.labels.map((label, index) => (
              <div key={index} className={classes.zone} style={zoneStyle(place, label.textBox, figure.aiLabels)} data-state={right[index] ? "correct" : "wrong"} title={label.text}>
                <span className={classes.zoneText}>{label.text}</span>
              </div>
            ))
          }
        />
        <Group justify="space-between" gap="sm">
          <Group gap={8}>
            <ThemeIcon radius="xl" color={score === figure.labels.length ? "teal" : "clay"} size={28}>
              {score === figure.labels.length ? <IconCheck size={16} stroke={3} /> : <IconX size={16} stroke={3} />}
            </ThemeIcon>
            <Text fw={600} role="status">
              {score} of {figure.labels.length} right
            </Text>
          </Group>
          <Button variant="light" leftSection={<IconRotate size={16} />} onClick={() => setAttempt(value => value + 1)}>
            Try again
          </Button>
        </Group>
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      <LabelImage key={attempt} roomId={roomId} figure={question} options={options} value={value} onChange={setValue} locked={false} />
      <Group justify="flex-end">
        <Button onClick={() => setChecked(true)} disabled={!complete} data-testid="check-labels">
          Check
        </Button>
      </Group>
    </Stack>
  );
}
