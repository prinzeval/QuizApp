import { Badge, Loader } from "@mantine/core";
import { IconAlertTriangle, IconCheck, IconClockHour4 } from "@tabler/icons-react";
import type { MaterialStatus } from "../../lib/learningApi.ts";

const STATUS: Record<MaterialStatus, { label: string; color: string }> = {
  queued: { label: "Queued", color: "gray" },
  processing: { label: "Processing", color: "clay" },
  ready: { label: "Ready", color: "teal" },
  failed: { label: "Failed", color: "red" },
};

export function MaterialStatusBadge({ status }: { status: MaterialStatus }) {
  const { label, color } = STATUS[status];
  const icon =
    status === "processing" ? (
      <Loader size={10} color="clay" aria-hidden="true" />
    ) : status === "ready" ? (
      <IconCheck size={12} stroke={2.5} aria-hidden="true" />
    ) : status === "failed" ? (
      <IconAlertTriangle size={12} stroke={2.2} aria-hidden="true" />
    ) : (
      <IconClockHour4 size={12} stroke={2.2} aria-hidden="true" />
    );

  return (
    <Badge data-testid="material-status" variant="light" color={color} leftSection={icon} tt="none" fw={600} style={{ flexShrink: 0 }}>
      {label}
    </Badge>
  );
}
