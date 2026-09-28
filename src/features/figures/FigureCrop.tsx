import { lazy, Suspense, useRef, type CSSProperties, type ReactNode } from "react";
import { ActionIcon, Box, Modal, Skeleton, Tooltip } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { IconArrowsMaximize } from "@tabler/icons-react";
import { useFigureImage, useMaterialFile } from "../../hooks/materialFile.ts";
import { useIsMobile } from "../../hooks/useIsMobile.ts";
import type { Box as FigureBox, FigurePlacement } from "../../lib/learningApi.ts";
import classes from "./Figure.module.css";
import { Unavailable } from "./Unavailable.tsx";

// pdf.js is big: load it only when a PDF figure is actually shown.
const FigurePdfPage = lazy(() => import("./FigurePdfPage.tsx"));

/** Printed labels are boxed tightly; cover a little extra so no letter peeks out. */
const MASK_PAD = 0.004;

export interface Placement {
  /** Absolute position (in %) of a page-relative box inside the crop. */
  place: (box: FigureBox, pad?: number) => CSSProperties;
  /** Page-relative point for a click/tap in the crop, or null outside it. */
  toPoint: (clientX: number, clientY: number) => [number, number] | null;
}

interface FigureCropProps {
  roomId: string;
  figure: FigurePlacement;
  /** Printed captions/labels to cover. */
  masks?: FigureBox[];
  /** Cap on height (px); the crop narrows to keep its shape. */
  maxHeight?: number;
  /** Anything drawn over the picture (spots, pins, answers). */
  overlay?: (placement: Placement) => ReactNode;
  /** Tap-to-answer: a click anywhere on the picture. */
  onPick?: (point: [number, number]) => void;
  /** Shows an "enlarge" button that opens the same crop full size. */
  enlargeable?: boolean;
  onEnlarge?: () => void;
  label: string;
}

/**
 * Shows one figure by cropping the original file: the PDF page (or photo) is
 * drawn at a size where the figure's box fills the frame, and the frame hides
 * the rest. The file itself is never changed or copied.
 */
export function FigureCrop({ roomId, figure, masks = [], maxHeight, overlay, onPick, enlargeable, onEnlarge, label }: FigureCropProps) {
  const { ref: outerRef, width: available } = useElementSize();
  const frameRef = useRef<HTMLDivElement>(null);
  const [x, y, w, h] = figure.box;
  // Crop shape = box shape on the page: (w · pageWidth) / (h · pageHeight).
  const ratio = (w * figure.aspect) / h;
  const width = Math.max(0, Math.min(available, maxHeight ? maxHeight * ratio : Infinity));

  const place = (box: FigureBox, pad = 0): CSSProperties => ({
    left: `${((box[0] - pad - x) / w) * 100}%`,
    top: `${((box[1] - pad - y) / h) * 100}%`,
    width: `${((box[2] + 2 * pad) / w) * 100}%`,
    height: `${((box[3] + 2 * pad) / h) * 100}%`,
  });

  const toPoint = (clientX: number, clientY: number): [number, number] | null => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const fx = (clientX - rect.left) / rect.width;
    const fy = (clientY - rect.top) / rect.height;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return null;
    return [x + fx * w, y + fy * h];
  };

  return (
    <Box ref={outerRef} w="100%">
      {width > 0 && (
        <Box
          ref={frameRef}
          className={`${classes.frame} ${onPick ? classes.pickable : ""}`}
          w={width}
          h={width / ratio}
          mx="auto"
          role="img"
          aria-label={label}
          data-testid="figure-crop"
          onClick={event => {
            if (!onPick) return;
            const point = toPoint(event.clientX, event.clientY);
            if (point) onPick(point);
          }}
        >
          {/* The whole page, scaled and shifted so only the figure shows. */}
          <div className={classes.layer} style={{ left: `${(-x / w) * 100}%`, top: `${(-y / h) * 100}%`, width: `${100 / w}%`, height: `${100 / h}%` }}>
            <Source roomId={roomId} figure={figure} pageWidth={width / w} />
          </div>
          {masks.map((mask, index) => (
            <div key={index} className={classes.mask} style={place(mask, MASK_PAD)} aria-hidden="true" />
          ))}
          {overlay?.({ place, toPoint })}
          {enlargeable && onEnlarge && (
            <Tooltip label="Enlarge">
              <ActionIcon
                variant="default"
                radius="xl"
                size="lg"
                aria-label="Enlarge picture"
                onClick={event => {
                  event.stopPropagation();
                  onEnlarge();
                }}
                style={{ position: "absolute", right: 8, bottom: 8, boxShadow: "var(--mantine-shadow-sm)" }}
              >
                <IconArrowsMaximize size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Box>
      )}
    </Box>
  );
}

/** The original page or picture, drawn at `pageWidth` CSS pixels. */
function Source({ roomId, figure, pageWidth }: { roomId: string; figure: FigurePlacement; pageWidth: number }) {
  if (figure.hasImage) return <StoredImage roomId={roomId} figureId={figure.id} />;
  if (figure.materialKind === "image") return <MaterialImage roomId={roomId} materialId={figure.materialId} />;
  return (
    <Suspense fallback={<Skeleton h="100%" radius={0} />}>
      <FigurePdfPage roomId={roomId} materialId={figure.materialId} page={figure.page ?? 1} pageWidth={pageWidth} />
    </Suspense>
  );
}

function MaterialImage({ roomId, materialId }: { roomId: string; materialId: string }) {
  const file = useMaterialFile(roomId, materialId);
  if (file.isError) return <Unavailable />;
  if (!file.data) return <Skeleton h="100%" radius={0} />;
  return <img src={file.data.url} alt="" draggable={false} />;
}

function StoredImage({ roomId, figureId }: { roomId: string; figureId: string }) {
  const file = useFigureImage(roomId, figureId);
  if (file.isError) return <Unavailable />;
  if (!file.data) return <Skeleton h="100%" radius={0} />;
  return <img src={file.data.url} alt="" draggable={false} />;
}

/** A full-size look at a figure, with whatever overlay the caller shows. */
export function FigureModal({
  opened,
  onClose,
  title,
  children,
}: {
  opened: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const mobile = useIsMobile();
  return (
    <Modal opened={opened} onClose={onClose} title={title} size="80rem" fullScreen={mobile} centered>
      {children}
    </Modal>
  );
}
