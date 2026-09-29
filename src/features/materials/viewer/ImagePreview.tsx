import { useState } from "react";
import { ActionIcon, Box, Group, Paper, SegmentedControl, Text, Tooltip } from "@mantine/core";
import { IconZoomIn, IconZoomOut } from "@tabler/icons-react";
import { useIsMobile } from "../../../hooks/useIsMobile.ts";
import classes from "./Viewer.module.css";

type Zoom = "fit" | number;
const STEPS = [0.25, 0.5, 1, 1.5, 2, 3, 4];

/** A photo or scan at a comfortable size, with Fit / 100% and zoom steps (pinch works on phones too). */
export function ImagePreview({ url, title }: { url: string; title: string }) {
  const mobile = useIsMobile();
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const scale = zoom === "fit" ? null : zoom;
  const index = scale === null ? -1 : STEPS.indexOf(scale);
  const size = mobile ? 40 : 34;

  const step = (direction: 1 | -1) => {
    if (scale === null) return setZoom(direction > 0 ? 1 : 0.5);
    const next = STEPS[index + direction];
    if (next) setZoom(next);
  };

  return (
    <Box data-testid="image-preview">
      <Paper className={classes.toolbar} withBorder radius="md" px="xs" py={4} mb="md">
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Text size="sm" c="dimmed" truncate>
            {natural ? `${natural.width} × ${natural.height}` : "Image"}
            {scale !== null && scale !== 1 ? ` · ${Math.round(scale * 100)}%` : ""}
          </Text>
          <Group gap={4} wrap="nowrap">
            <Tooltip label="Zoom out" withArrow disabled={mobile}>
              <ActionIcon variant="subtle" color="gray" size={size} onClick={() => step(-1)} disabled={index === 0} aria-label="Zoom out">
                <IconZoomOut size={18} />
              </ActionIcon>
            </Tooltip>
            <SegmentedControl
              size="xs"
              value={zoom === "fit" ? "fit" : zoom === 1 ? "100" : ""}
              onChange={value => setZoom(value === "fit" ? "fit" : 1)}
              data={[
                { value: "fit", label: "Fit" },
                { value: "100", label: "100%" },
              ]}
              aria-label="Image size"
              styles={{ label: { minHeight: mobile ? 32 : undefined, display: "flex", alignItems: "center" } }}
            />
            <Tooltip label="Zoom in" withArrow disabled={mobile}>
              <ActionIcon variant="subtle" color="gray" size={size} onClick={() => step(1)} disabled={index === STEPS.length - 1} aria-label="Zoom in">
                <IconZoomIn size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Paper>

      <div className={classes.imageStage} data-zoomed={scale !== null || undefined} onDoubleClick={() => setZoom(zoom === "fit" ? 1 : "fit")}>
        <img
          src={url}
          alt={title}
          onLoad={event => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          style={
            scale === null
              ? { maxWidth: "100%", maxHeight: "calc(100dvh - var(--app-shell-header-offset, 0px) - 140px)", objectFit: "contain" }
              : { width: natural ? natural.width * scale : undefined, maxWidth: "none" }
          }
          data-testid="image-preview-img"
        />
      </div>
    </Box>
  );
}
