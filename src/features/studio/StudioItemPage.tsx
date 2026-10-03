import { Link, useParams } from "react-router-dom";
import { Alert, Button, Center, EmptyState, Group, Loader, Progress, Stack, Text, ThemeIcon, Title, VisuallyHidden } from "@mantine/core";
import { IconAlertTriangle, IconChevronLeft, IconRefresh } from "@tabler/icons-react";
import { useAuth } from "../../auth/AuthContext.tsx";
import { useRefreshStudioItem, useRetryStudioItem, useStudioItem } from "../../hooks/learning.ts";
import { useRoom } from "../../hooks/rooms.ts";
import type { StudioItem } from "../../lib/learningApi.ts";
import { notify } from "../../notify.ts";
import { ApiError } from "../../lib/api.ts";
import { plural } from "../../lib/format.ts";
import { useRoomLive } from "../../realtime/useRoomLive.ts";
import { ImageCards } from "./ImageCards.tsx";
import { MindMap } from "./MindMap.tsx";
import { STUDIO_TOOLS } from "./studioKinds.ts";

/** Opens one Studio item: image cards or a mind map. */
export function StudioItemPage() {
  const { roomId = "", itemId = "" } = useParams();
  useRoomLive(roomId);
  const query = useStudioItem(roomId, itemId);

  const back = (
    <Button component={Link} to={`/rooms/${roomId}?tab=studio`} variant="subtle" color="gray" c="dimmed" fw={500} px={8} ml={-8} mb="md" leftSection={<IconChevronLeft size={16} aria-hidden="true" />}>
      Studio
    </Button>
  );

  if (query.isPending) {
    return (
      <Center py={96} role="status">
        <Loader aria-hidden="true" />
        <VisuallyHidden>Loading…</VisuallyHidden>
      </Center>
    );
  }

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <>
        {back}
        <EmptyState
          title={notFound ? "Not found" : "Couldn't load this"}
          description={notFound ? "It may have been deleted." : query.error.message}
          py={56}
          bd="1px dashed var(--mantine-color-default-border)"
          bdrs="lg"
        />
      </>
    );
  }

  const data = query.data;
  const { item } = data;
  const tool = STUDIO_TOOLS[item.kind];
  const Icon = tool.icon;
  const sources = item.materials.map(material => material.title).join(", ");

  return (
    <>
      {back}
      <Group gap="sm" wrap="nowrap" mb="lg" align="flex-start">
        <ThemeIcon variant="light" color={tool.color} size={44} radius="md" style={{ flexShrink: 0 }}>
          <Icon size={24} stroke={1.7} />
        </ThemeIcon>
        <Stack gap={2} miw={0}>
          <Title order={1} size="h2" style={{ overflowWrap: "anywhere" }}>
            {item.title}
          </Title>
          <Text size="sm" c="dimmed" lineClamp={2}>
            {tool.label} · {item.kind === "image_cards" ? plural(data.figures.length, "picture") : plural(item.size, "topic")} · from {sources || "deleted files"}
          </Text>
        </Stack>
      </Group>

      {item.kind === "image_cards" && "figures" in data && data.figures.length > 0 && item.status !== "ready" ? (
        <Stack gap="lg">
          <StillFinding roomId={roomId} item={item} found={data.figures.length} />
          <ImageCards roomId={roomId} figures={data.figures} growing={item.status === "generating"} />
        </Stack>
      ) : item.status !== "ready" ? (
        <EmptyState
          title={item.status === "failed" ? "This didn't work" : "Still being made…"}
          description={item.status === "failed" ? item.error ?? "Something went wrong." : "It'll appear here by itself when it's ready."}
          py={56}
          bd="1px dashed var(--mantine-color-default-border)"
          bdrs="lg"
        />
      ) : "map" in data ? (
        <MindMap itemId={item.id} roomId={roomId} nodes={data.map.nodes} links={data.map.links} figures={data.figures} />
      ) : (
        <Stack gap="md">
          <ImageCards roomId={roomId} figures={data.figures} />
          <LookAgain roomId={roomId} item={item} />
        </Stack>
      )}
    </>
  );
}

/** Looks through the files again from scratch, e.g. so a diagram without printed labels gets AI labels. */
function LookAgain({ roomId, item }: { roomId: string; item: StudioItem }) {
  const { user } = useAuth();
  const room = useRoom(roomId);
  const refresh = useRefreshStudioItem(roomId);
  const canManage = room.data?.room.role === "owner" || (!!user && item.createdBy === user.id);
  if (!canManage) return null;

  return (
    <Group justify="center" gap="xs">
      <Text size="xs" c="dimmed">
        Missing pictures or labels?
      </Text>
      <Button
        size="xs"
        variant="subtle"
        leftSection={<IconRefresh size={14} />}
        loading={refresh.isPending}
        data-testid="look-again"
        onClick={() =>
          refresh.mutate(item.id, {
            onSuccess: () => notify("Looking through your files again…", "info"),
            onError: error => notify(error.message, "error"),
          })
        }
      >
        Look through again
      </Button>
    </Group>
  );
}

/** Shown above cards that are still arriving, or when finding them stopped part-way. */
function StillFinding({ roomId, item, found }: { roomId: string; item: StudioItem; found: number }) {
  const { user } = useAuth();
  const room = useRoom(roomId);
  const retry = useRetryStudioItem(roomId);
  const canRetry = room.data?.room.role === "owner" || (!!user && item.createdBy === user.id);
  const progress = item.progress && item.progress.total > 0 ? item.progress : null;

  if (item.status === "failed") {
    return (
      <Alert color="clay" variant="light" icon={<IconAlertTriangle size={18} />} title={`Stopped with ${plural(found, "card")} found`} data-testid="cards-stopped">
        <Stack gap="xs">
          <Text size="sm">{item.error ?? "Something went wrong."} The cards below are ready to study.</Text>
          {canRetry && (
            <Button
              size="xs"
              variant="light"
              leftSection={<IconRefresh size={14} />}
              w="fit-content"
              loading={retry.isPending}
              onClick={() => retry.mutate(item.id, { onSuccess: () => notify("Carrying on…", "info"), onError: error => notify(error.message, "error") })}
            >
              Carry on
            </Button>
          )}
        </Stack>
      </Alert>
    );
  }

  return (
    <Alert color="teal" variant="light" icon={<Loader size={16} color="teal" />} title="Still looking for pictures" role="status" data-testid="cards-growing">
      <Stack gap={6}>
        <Text size="sm">
          {progress ? `${progress.done} of ${progress.total} pages checked. ` : ""}Start studying now: new cards join the deck as they're found, and you keep your place.
        </Text>
        {progress && <Progress value={(100 * progress.done) / progress.total} size="sm" color="teal" maw={360} aria-hidden="true" />}
      </Stack>
    </Alert>
  );
}
