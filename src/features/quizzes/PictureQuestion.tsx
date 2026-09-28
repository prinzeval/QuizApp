import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Badge, Button, Group, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconCheck, IconHandFinger, IconX } from "@tabler/icons-react";
import type { Box as FigureBox, Figure, QuestionFigure, QuestionReview } from "../../lib/learningApi.ts";
import { FigureCrop, FigureModal, type Placement } from "../figures/FigureCrop.tsx";
import classes from "../figures/Figure.module.css";

/** Figures are shown big enough to read, but never taller than most of the screen. */
const MAX_HEIGHT = 520;
const ZONE_PAD = 0.006;

/* ------------------------------------------------------------------ helpers */

/** "2,,1" → [2, null, 1]; one entry per spot. */
export function parsePlacement(value: string, spots: number): (number | null)[] {
  const parts = value ? value.split(",") : [];
  return Array.from({ length: spots }, (_, index) => {
    const part = parts[index];
    return part === undefined || part === "" ? null : Number(part);
  });
}

const formatPlacement = (placed: (number | null)[]) =>
  placed.every(value => value === null) ? "" : placed.map(value => (value === null ? "" : String(value))).join(",");

/** "0.4123,0.6000" → [0.4123, 0.6], or null. */
export function parsePoint(value: string): [number, number] | null {
  const parts = value.split(",").map(Number);
  return parts.length === 2 && parts.every(Number.isFinite) ? [parts[0], parts[1]] : null;
}

/** True when a response can be sent: every label placed, or a spot tapped. */
export function isPictureAnswerComplete(type: string, value: string, spots: number): boolean {
  if (type === "label_image") return spots > 0 && parsePlacement(value, spots).every(entry => entry !== null);
  if (type === "locate_image") return parsePoint(value) !== null;
  return !!value.trim();
}

/** The figure a question shows, from either the question (covered) or its review (revealed). */
function figureMasks(figure: Figure): FigureBox[] {
  return [...(figure.captionBox ? [figure.captionBox] : []), ...figure.labels.map(label => label.textBox)];
}

/* ------------------------------------------------------- a picture to answer */

/**
 * The picture shown with a regular (choice or typed) question: captions and
 * labels covered until the answer is revealed, then shown with the caption.
 */
export function QuestionPicture({ roomId, figure, review }: { roomId: string; figure: QuestionFigure; review: QuestionReview | null }) {
  const [enlarged, setEnlarged] = useState(false);
  const revealed = review?.figure ?? null;
  const masks = revealed ? [] : figure.masks;
  const crop = (maxHeight?: number) => (
    <FigureCrop
      roomId={roomId}
      figure={figure}
      masks={masks}
      maxHeight={maxHeight}
      enlargeable={maxHeight !== undefined}
      onEnlarge={() => setEnlarged(true)}
      label={revealed ? revealed.title : "The picture for this question. Its labels are covered."}
    />
  );

  return (
    <Stack gap={6}>
      {crop(MAX_HEIGHT)}
      {revealed?.caption && (
        <Text size="sm" c="dimmed" ta="center" style={{ overflowWrap: "anywhere" }}>
          {revealed.caption}
        </Text>
      )}
      <FigureModal opened={enlarged} onClose={() => setEnlarged(false)} title="Picture">
        {crop()}
      </FigureModal>
    </Stack>
  );
}

/* --------------------------------------------------------- drag the labels */

/** A revealed figure in the shape a question uses (so input and answer share one crop). */
const asQuestionFigure = (figure: Figure, type: string): QuestionFigure => ({
  ...figure,
  masks: figureMasks(figure),
  zones: type === "label_image" ? figure.labels.map(label => label.textBox) : null,
});

/** Pins are a fixed size: position them by their point only. */
const pinAt = (place: (box: FigureBox) => CSSProperties, [x, y]: [number, number]): CSSProperties => {
  const { left, top } = place([x, y, 0, 0]);
  return { left, top };
};

interface LabelImageProps {
  roomId: string;
  figure: QuestionFigure;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  /** Once answered: shows each spot's correct label and how you did. */
  review?: QuestionReview | null;
}

/**
 * Put each label on its spot: drag a label onto a numbered spot, or tap a
 * label then a spot (works with touch, mouse and keyboard). Tapping a filled
 * spot sends its label back. The same picture then shows the answer, so it
 * isn't redrawn when the answer is revealed.
 */
export function LabelImage({ roomId, figure, options, value, onChange, locked, review }: LabelImageProps) {
  const zones = figure.zones ?? [];
  const revealed = review?.figure ?? null;
  const [placed, setPlaced] = useState(() => parsePlacement(value, zones.length));
  const [armed, setArmed] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ option: number; x: number; y: number } | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  const start = useRef<{ option: number; x: number; y: number; pointerId: number } | null>(null);
  const answering = !review && !locked;

  // A response restored from the server (e.g. resuming an exam) wins over local state.
  useEffect(() => {
    if (value) setPlaced(parsePlacement(value, zones.length));
  }, [value, zones.length]);

  const update = (next: (number | null)[]) => {
    setPlaced(next);
    onChange(formatPlacement(next));
  };

  const put = (option: number, zone: number) => {
    const next = placed.map(entry => (entry === option ? null : entry));
    next[zone] = option;
    update(next);
    setArmed(null);
  };

  const onZone = (zone: number) => {
    if (!answering) return;
    if (armed !== null) return put(armed, zone);
    if (placed[zone] !== null) update(placed.map((entry, index) => (index === zone ? null : entry)));
  };

  // Pointer dragging: a small move turns a press into a drag; a still press is a tap.
  useEffect(() => {
    if (!answering) return;
    const zoneAt = (x: number, y: number) => {
      const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-zone]");
      return element ? Number(element.dataset.zone) : null;
    };
    const move = (event: PointerEvent) => {
      const pressed = start.current;
      if (!pressed || event.pointerId !== pressed.pointerId) return;
      if (!drag && Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) < 6) return;
      event.preventDefault();
      setDrag({ option: pressed.option, x: event.clientX, y: event.clientY });
      setOver(zoneAt(event.clientX, event.clientY));
    };
    const up = (event: PointerEvent) => {
      const pressed = start.current;
      if (!pressed || event.pointerId !== pressed.pointerId) return;
      start.current = null;
      if (drag) {
        const zone = zoneAt(event.clientX, event.clientY);
        if (zone !== null) put(pressed.option, zone);
      } else {
        setArmed(current => (current === pressed.option ? null : pressed.option));
      }
      setDrag(null);
      setOver(null);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  });

  // Answer view: spot i's correct label is revealed.labels[i]; yours is options[placed[i]].
  const mine = review ? parsePlacement(review.response ?? "", zones.length) : placed;
  const isRight = (index: number) => {
    const option = mine[index];
    return !!revealed && option !== null && option !== undefined && options[option] === revealed.labels[index]?.text;
  };
  const bank = options.map((text, option) => ({ text, option })).filter(({ option }) => !placed.includes(option));

  const overlay = ({ place }: Placement) =>
    zones.map((zone, index) => {
      if (revealed) {
        const label = revealed.labels[index]?.text ?? "";
        return (
          <div key={index} className={classes.zone} style={place(zone, ZONE_PAD)} data-state={isRight(index) ? "correct" : "wrong"} title={label}>
            <span className={classes.zoneText}>{label}</span>
          </div>
        );
      }
      const option = placed[index];
      return (
        <button
          key={index}
          type="button"
          className={classes.zone}
          style={place(zone, ZONE_PAD)}
          data-zone={index}
          data-filled={option !== null || undefined}
          data-over={over === index || undefined}
          data-armed={armed !== null || undefined}
          data-testid="label-zone"
          disabled={!answering}
          title={option !== null ? options[option] : `Spot ${index + 1}`}
          aria-label={option !== null ? `Spot ${index + 1}: ${options[option]}. Tap to remove.` : `Spot ${index + 1}, empty`}
          onClick={() => onZone(index)}
        >
          <span className={classes.zoneText}>{option !== null ? options[option] : index + 1}</span>
        </button>
      );
    });

  const crop = (maxHeight?: number) => (
    <FigureCrop
      roomId={roomId}
      figure={revealed ?? figure}
      masks={figure.masks}
      maxHeight={maxHeight}
      enlargeable={!!revealed && maxHeight !== undefined}
      onEnlarge={() => setEnlarged(true)}
      label={revealed ? `${revealed.title}, with the correct labels` : `A picture with ${zones.length} numbered spots to label`}
      overlay={overlay}
    />
  );

  return (
    <Stack gap="md">
      {crop(MAX_HEIGHT)}

      {answering && (
        <Stack gap={8}>
          <Group gap={6} c="dimmed">
            <IconHandFinger size={16} aria-hidden="true" />
            <Text size="sm">
              {bank.length === 0
                ? "All placed. Tap a spot to take its label back."
                : armed !== null
                  ? `Now tap the spot for “${options[armed]}”.`
                  : "Drag each label onto its spot, or tap a label and then a spot."}
            </Text>
          </Group>
          <Group gap="xs" role="group" aria-label="Labels to place" data-testid="label-bank">
            {bank.map(({ text, option }) => (
              <Button
                key={option}
                variant={armed === option ? "filled" : "default"}
                radius="xl"
                size="sm"
                data-testid="label-chip"
                aria-pressed={armed === option}
                style={{ touchAction: "none", cursor: "grab", opacity: drag?.option === option ? 0.4 : 1 }}
                onPointerDown={event => {
                  if (event.button !== 0) return;
                  start.current = { option, x: event.clientX, y: event.clientY, pointerId: event.pointerId };
                }}
                onKeyDown={event => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setArmed(current => (current === option ? null : option));
                  }
                }}
              >
                {text}
              </Button>
            ))}
          </Group>
        </Stack>
      )}

      {revealed && (
        <Stack gap={4} component="ol" style={{ listStyle: "none", padding: 0, margin: 0 }} data-testid="label-review">
          {revealed.labels.map((label, index) => {
            const option = mine[index];
            const placedText = option !== null && option !== undefined ? options[option] : null;
            const right = isRight(index);
            return (
              <Group key={index} component="li" gap={8} wrap="nowrap">
                <ThemeIcon size={20} radius="xl" color={right ? "teal" : "red"} aria-label={right ? "Correct" : "Incorrect"} role="img">
                  {right ? <IconCheck size={12} stroke={3} /> : <IconX size={12} stroke={3} />}
                </ThemeIcon>
                <Text size="sm" style={{ overflowWrap: "anywhere" }}>
                  <strong>{label.text}</strong>
                  {!right && (
                    <Text span size="sm" c="dimmed">
                      {placedText ? ` (you put “${placedText}” here)` : " (left empty)"}
                    </Text>
                  )}
                </Text>
              </Group>
            );
          })}
        </Stack>
      )}

      {drag && (
        <div className={classes.ghost} style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          <Badge size="lg" radius="xl" variant="filled" tt="none" style={{ boxShadow: "var(--mantine-shadow-md)" }}>
            {options[drag.option]}
          </Badge>
        </div>
      )}

      {revealed && (
        <FigureModal opened={enlarged} onClose={() => setEnlarged(false)} title={revealed.title}>
          {crop()}
        </FigureModal>
      )}
    </Stack>
  );
}

/** The answer to a drag-the-labels question on its own (results screen). */
export function LabelImageReview({ roomId, review }: { roomId: string; review: QuestionReview }) {
  if (!review.figure) return null;
  return (
    <LabelImage
      roomId={roomId}
      figure={asQuestionFigure(review.figure, "label_image")}
      options={review.options ?? []}
      value={review.response ?? ""}
      onChange={() => {}}
      locked
      review={review}
    />
  );
}

/* ------------------------------------------------------------ tap the spot */

interface LocateImageProps {
  roomId: string;
  figure: QuestionFigure;
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  /** Once answered: highlights the part and colours your tap. */
  review?: QuestionReview | null;
}

/** Tap (or click) the part the question names; the tap can be moved until you check. Then the answer shows on the same picture. */
export function LocateImage({ roomId, figure, value, onChange, locked, review }: LocateImageProps) {
  const [enlarged, setEnlarged] = useState(false);
  const revealed = review?.figure ?? null;
  const target = revealed?.labels[review?.correctIndex ?? -1];
  const point = parsePoint(review ? review.response ?? "" : value);
  const answering = !review && !locked;

  const crop = (maxHeight?: number) => (
    <FigureCrop
      roomId={roomId}
      figure={revealed ?? figure}
      masks={revealed ? [] : figure.masks}
      maxHeight={maxHeight}
      enlargeable={!!revealed && maxHeight !== undefined}
      onEnlarge={() => setEnlarged(true)}
      label={
        revealed ? (target ? `${revealed.title}, with ${target.text} highlighted` : revealed.title) : "The picture. Tap the part the question asks for."
      }
      onPick={answering ? ([x, y]) => onChange(`${x.toFixed(4)},${y.toFixed(4)}`) : undefined}
      overlay={({ place }) => (
        <>
          {target && <div className={classes.target} style={place(target.targetBox)} data-testid="tap-target" />}
          {point && (
            <div className={classes.pin} style={pinAt(place, point)} data-state={review ? (review.isCorrect ? "correct" : "wrong") : undefined} data-testid="tap-pin" />
          )}
        </>
      )}
    />
  );

  return (
    <Stack gap="xs">
      {crop(MAX_HEIGHT)}
      {answering && (
        <Group gap={6} c="dimmed">
          <IconHandFinger size={16} aria-hidden="true" />
          <Text size="sm">{point ? "Tap somewhere else to move your answer." : "Tap the spot on the picture."}</Text>
        </Group>
      )}
      {revealed && (
        <FigureModal opened={enlarged} onClose={() => setEnlarged(false)} title={revealed.title}>
          {crop()}
        </FigureModal>
      )}
    </Stack>
  );
}

/** The answer to a tap question on its own (results screen). */
export function LocateImageReview({ roomId, review }: { roomId: string; review: QuestionReview }) {
  if (!review.figure) return null;
  return <LocateImage roomId={roomId} figure={asQuestionFigure(review.figure, "locate_image")} value={review.response ?? ""} onChange={() => {}} locked review={review} />;
}
