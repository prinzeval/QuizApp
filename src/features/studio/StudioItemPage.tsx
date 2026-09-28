import { Link, useParams } from "react-router-dom";
import { Button, Center, EmptyState, Group, Loader, Stack, Text, ThemeIcon, Title, VisuallyHidden } from "@mantine/core";
import { IconChevronLeft } from "@tabler/icons-react";
import { useStudioItem } from "../../hooks/learning.ts";
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

      {item.status !== "ready" ? (
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
        <ImageCards roomId={roomId} figures={data.figures} />
      )}
    </>
  );
}
