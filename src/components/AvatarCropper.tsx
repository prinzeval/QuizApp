import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Alert, Box, Button, Group, Loader, Slider, Stack, Text } from "@mantine/core";
import { IconAlertCircle, IconZoomIn, IconZoomOut } from "@tabler/icons-react";

const VIEWPORT = 280;
const OUTPUT = 512;

interface Props {
  file: File;
  onCancel: () => void;
  onConfirm: (image: Blob) => Promise<void>;
}

interface Crop {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Square crop for a profile photo: drag to reposition, slider (or +/-) to zoom,
 * arrow keys to nudge. Exports a 512×512 image so uploads stay small.
 */
export function AvatarCropper({ file, onCancel, onConfirm }: Props) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState("");
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, zoom: 1 });
  const [saving, setSaving] = useState(false);
  const drag = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // A load that finishes after cleanup would show an already-revoked URL.
      if (cancelled) return;
      setImage(img);
      const base = VIEWPORT / Math.min(img.naturalWidth, img.naturalHeight);
      setCrop({ zoom: 1, x: (VIEWPORT - img.naturalWidth * base) / 2, y: (VIEWPORT - img.naturalHeight * base) / 2 });
    };
    img.onerror = () => !cancelled && setError("That file couldn't be opened as an image.");
    img.src = url;
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const scaleFor = (zoom: number) => (image ? (VIEWPORT / Math.min(image.naturalWidth, image.naturalHeight)) * zoom : 1);

  // Keep the image covering the whole square.
  const clamp = (next: Crop): Crop => {
    if (!image) return next;
    const scale = scaleFor(next.zoom);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    return {
      zoom: next.zoom,
      x: Math.min(0, Math.max(VIEWPORT - width, next.x)),
      y: Math.min(0, Math.max(VIEWPORT - height, next.y)),
    };
  };

  const setZoom = (zoom: number) => {
    setCrop(current => {
      // Zoom around the centre of the square.
      const oldScale = scaleFor(current.zoom);
      const newScale = scaleFor(zoom);
      const cx = (VIEWPORT / 2 - current.x) / oldScale;
      const cy = (VIEWPORT / 2 - current.y) / oldScale;
      return clamp({ zoom, x: VIEWPORT / 2 - cx * newScale, y: VIEWPORT / 2 - cy * newScale });
    });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startY: event.clientY, x: crop.x, y: crop.y };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    setCrop(current => clamp({ ...current, x: start.x + event.clientX - start.startX, y: start.y + event.clientY - start.startY }));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 20 : 5;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[event.key]) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      setCrop(current => clamp({ ...current, x: current.x + dx, y: current.y + dy }));
    } else if (event.key === "+" || event.key === "=") setZoom(Math.min(3, crop.zoom + 0.1));
    else if (event.key === "-") setZoom(Math.max(1, crop.zoom - 0.1));
  };

  async function confirm() {
    if (!image) return;
    const scale = scaleFor(crop.zoom);
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, -crop.x / scale, -crop.y / scale, VIEWPORT / scale, VIEWPORT / scale, 0, 0, OUTPUT, OUTPUT);
    // WebP where the browser can encode it; browsers that can't fall back to PNG.
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", 0.9));
    if (!blob) {
      setError("Couldn't process that image. Try another one.");
      return;
    }
    setSaving(true);
    try {
      await onConfirm(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setSaving(false);
    }
  }

  const scale = scaleFor(crop.zoom);

  return (
    <Stack gap="md">
      {error && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
          {error}
        </Alert>
      )}
      <Box
        pos="relative"
        w={VIEWPORT}
        h={VIEWPORT}
        mx="auto"
        bg="dark.9"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={onKeyDown}
        tabIndex={0}
        data-autofocus
        role="application"
        aria-label="Photo crop area. Drag or use arrow keys to move, plus and minus to zoom."
        style={{ overflow: "hidden", borderRadius: "var(--mantine-radius-md)", cursor: "grab", touchAction: "none", userSelect: "none" }}
      >
        {image ? (
          <img
            src={image.src}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              maxWidth: "none",
              pointerEvents: "none",
              width: image.naturalWidth * scale,
              height: image.naturalHeight * scale,
              transform: `translate(${crop.x}px, ${crop.y}px)`,
            }}
          />
        ) : (
          !error && <Loader color="gray.0" pos="absolute" top="50%" left="50%" style={{ translate: "-50% -50%" }} aria-hidden="true" />
        )}
        {/* Dims everything outside the circle that others will see. */}
        <Box
          pos="absolute"
          inset={0}
          aria-hidden="true"
          style={{ borderRadius: "50%", boxShadow: "0 0 0 999px rgba(15, 17, 23, 0.55)", outline: "2px solid rgba(255, 255, 255, 0.8)", outlineOffset: -2, pointerEvents: "none" }}
        />
      </Box>
      <Group gap="sm" wrap="nowrap" w={VIEWPORT} mx="auto">
        <IconZoomOut size={18} aria-hidden="true" color="var(--mantine-color-dimmed)" />
        <Slider
          flex={1}
          min={1}
          max={3}
          step={0.01}
          value={crop.zoom}
          onChange={setZoom}
          disabled={!image}
          label={null}
          thumbLabel="Zoom"
        />
        <IconZoomIn size={18} aria-hidden="true" color="var(--mantine-color-dimmed)" />
      </Group>
      <Text size="sm" c="dimmed" ta="center">
        Drag to reposition. The circle shows what others will see.
      </Text>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={confirm} disabled={!image} loading={saving}>
          Save photo
        </Button>
      </Group>
    </Stack>
  );
}
