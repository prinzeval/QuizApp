import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Badge, Button, Card, EmptyState, Group, SimpleGrid, Skeleton, Text, TextInput, Title } from "@mantine/core";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { useAuth } from "../auth/AuthContext.tsx";
import { useCreateRoom, useRooms } from "../hooks/rooms.ts";
import { plural, timeAgo } from "../lib/format.ts";
import { notify } from "../notify.ts";
import { BookDoodle } from "../components/Doodles.tsx";
import { FormModal } from "../components/FormModal.tsx";
import { RoomForm } from "../components/RoomForm.tsx";
import { RoomAvatar } from "../components/RoomAvatar.tsx";
import type { Room } from "../lib/api.ts";
import classes from "../components/InteractiveCard.module.css";

export function RoomsPage() {
  const { user } = useAuth();
  const rooms = useRooms();
  const createRoom = useCreateRoom();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");

  // "New room" in the sidebar links to /?new=1 so it works from any page.
  const creating = searchParams.get("new") === "1";
  const setCreating = (open: boolean) => setSearchParams(open ? { new: "1" } : {}, { replace: !open });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle || !rooms.data) return rooms.data;
    return rooms.data.filter(room => `${room.name} ${room.description}`.toLowerCase().includes(needle));
  }, [rooms.data, search]);

  const newRoomButton = (
    <Button leftSection={<IconPlus size={16} stroke={2.5} />} onClick={() => setCreating(true)}>
      New room
    </Button>
  );

  return (
    <>
      <Group justify="space-between" align="flex-end" gap="md" mb="xl">
        <div>
          <Text size="sm" fw={600} c="var(--mantine-color-anchor)">
            {greeting()}, {user?.name.split(" ")[0]}
          </Text>
          <Title order={1} mt={4}>
            Your study rooms
          </Title>
          <Text c="dimmed" mt={6}>
            Each room holds the notes, quizzes and people for one subject.
          </Text>
        </div>
        {rooms.data && rooms.data.length > 0 && newRoomButton}
      </Group>

      {rooms.data && rooms.data.length > 3 && (
        <Group justify="space-between" gap="md" mb="lg">
          <TextInput
            type="search"
            placeholder="Search rooms"
            aria-label="Search rooms"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={e => setSearch(e.currentTarget.value)}
            w={{ base: "100%", xs: 320 }}
          />
          <Text size="sm" c="dimmed">
            {filtered?.length === rooms.data.length ? `${rooms.data.length} rooms` : `${filtered?.length} of ${rooms.data.length} rooms`}
          </Text>
        </Group>
      )}

      {rooms.isPending ? (
        <SimpleGrid cols={{ base: 1, xs: 2, lg: 3 }} spacing="md" aria-busy="true" aria-label="Loading rooms">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} h={172} radius="lg" />
          ))}
        </SimpleGrid>
      ) : rooms.isError ? (
        <EmptyState
          title="Couldn't load your rooms"
          description={rooms.error.message}
          py={56}
          bd="1px dashed var(--mantine-color-default-border)"
          bdrs="lg"
        >
          <EmptyState.Actions>
            <Button variant="default" onClick={() => rooms.refetch()}>
              Try again
            </Button>
          </EmptyState.Actions>
        </EmptyState>
      ) : rooms.data.length === 0 ? (
        <EmptyState
          icon={<BookDoodle />}
          title="Create your first study room"
          description="A room is where one subject lives: upload your notes, generate quizzes, and invite friends."
          py={56}
          px="md"
          bd="1px dashed var(--mantine-color-default-border)"
          bdrs="lg"
        >
          <EmptyState.Actions>{newRoomButton}</EmptyState.Actions>
        </EmptyState>
      ) : filtered?.length === 0 ? (
        <EmptyState title={`No rooms match "${search}"`} py={56} bd="1px dashed var(--mantine-color-default-border)" bdrs="lg">
          <EmptyState.Actions>
            <Button variant="default" onClick={() => setSearch("")}>
              Clear search
            </Button>
          </EmptyState.Actions>
        </EmptyState>
      ) : (
        <SimpleGrid component="ul" cols={{ base: 1, xs: 2, lg: 3 }} spacing="md" p={0} m={0} style={{ listStyle: "none" }}>
          {filtered?.map(room => (
            <RoomCard key={room.id} room={room} />
          ))}
        </SimpleGrid>
      )}

      <FormModal opened={creating} onClose={() => setCreating(false)} title="New study room">
        <RoomForm
          submitLabel="Create room"
          onCancel={() => setCreating(false)}
          onSubmit={async input => {
            const room = await createRoom.mutateAsync(input);
            navigate(`/rooms/${room.id}`, { replace: true });
            notify(`Created "${room.name}"`);
          }}
        />
      </FormModal>
    </>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function RoomCard({ room }: { room: Room }) {
  return (
    <li>
      <Card component={Link} to={`/rooms/${room.id}`} data-testid="room-card" h="100%" shadow="xs" className={classes.card}>
        <Group justify="space-between" align="flex-start">
          <RoomAvatar room={room} size={44} />
          {room.role === "owner" && (
            <Badge variant="light" size="sm">
              Owner
            </Badge>
          )}
        </Group>
        <Title order={2} size="h3" mt="md" lineClamp={1} data-testid="room-card-name">
          {room.name}
        </Title>
        <Text size="sm" c="dimmed" mt={4} lineClamp={2} fs={room.description ? undefined : "italic"} mih={42}>
          {room.description || "No description"}
        </Text>
        <Text size="xs" c="dimmed" mt="md">
          {plural(room.memberCount, "member")} · Updated {timeAgo(room.updatedAt)}
        </Text>
      </Card>
    </li>
  );
}
