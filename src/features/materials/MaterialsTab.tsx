import { useMemo, useRef } from "react";
import { Button, EmptyState, Group, Paper, Skeleton, Stack, Text } from "@mantine/core";
import { IconUpload } from "@tabler/icons-react";
import type { Room } from "../../lib/api.ts";
import type { Material } from "../../lib/learningApi.ts";
import { plural } from "../../lib/format.ts";
import { useMaterials, useRetryMaterial } from "../../hooks/learning.ts";
import { notify } from "../../notify.ts";
import { CompactDropzone, HeroDropzone, UploadStatus, useMaterialUpload } from "./MaterialUploader.tsx";
import { MaterialList } from "./MaterialList.tsx";
import { useCanManage } from "./useCanManage.ts";

export function MaterialsTab({ room }: { room: Room }) {
  const materials = useMaterials(room.id);
  const upload = useMaterialUpload(room.id);
  const retry = useRetryMaterial(room.id);
  const canManage = useCanManage(room);
  const openPicker = useRef<() => void | undefined>(null);

  const sorted = useMemo(
    () => [...(materials.data?.materials ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [materials.data],
  );

  const onRetry = (material: Material) =>
    retry.mutate(material.id, {
      onSuccess: () => notify(`Trying "${material.title}" again…`, "info"),
      onError: error => notify(error.message, "error"),
    });

  if (materials.isPending) {
    return (
      <Stack gap="sm" aria-busy="true" aria-label="Loading materials">
        <Skeleton h={20} w={220} />
        {[0, 1, 2].map(i => (
          <Skeleton key={i} h={68} radius="lg" />
        ))}
      </Stack>
    );
  }

  if (materials.isError) {
    return (
      <EmptyState title="Couldn't load materials" description={materials.error.message} py={48} bd="1px dashed var(--mantine-color-default-border)" bdrs="lg">
        <EmptyState.Actions>
          <Button variant="default" onClick={() => materials.refetch()}>
            Try again
          </Button>
        </EmptyState.Actions>
      </EmptyState>
    );
  }

  if (sorted.length === 0) {
    return (
      <Stack gap="md" data-testid="materials-tab">
        <UploadStatus upload={upload} />
        <HeroDropzone upload={upload} openRef={openPicker} />
      </Stack>
    );
  }

  const ready = sorted.filter(m => m.status === "ready").length;
  const working = sorted.filter(m => m.status === "queued" || m.status === "processing").length;

  return (
    <Stack gap="md" data-testid="materials-tab">
      <Group justify="space-between" align="center" gap="sm" wrap="nowrap">
        <Stack gap={0} miw={0}>
          <Text fw={600}>{plural(sorted.length, "material")}</Text>
          <Text size="sm" c="dimmed">
            {working > 0 ? `${ready} ready · ${working} being read now` : "Everything's ready for quizzes and the tutor."}
          </Text>
        </Stack>
        <Button leftSection={<IconUpload size={16} />} onClick={() => openPicker.current?.()} loading={upload.uploading} style={{ flexShrink: 0 }}>
          Upload
        </Button>
      </Group>

      <CompactDropzone upload={upload} openRef={openPicker} />
      <UploadStatus upload={upload} />

      <MaterialList roomId={room.id} materials={sorted} canManage={canManage} onRetry={onRetry} retryingId={retry.isPending ? (retry.variables ?? null) : null} />

      {ready === 0 && working > 0 && (
        <Paper p="sm" radius="md" bg="var(--mantine-color-default-hover)">
          <Text size="xs" c="dimmed" ta="center">
            You can keep working while we read your files. Statuses update here automatically.
          </Text>
        </Paper>
      )}
    </Stack>
  );
}
