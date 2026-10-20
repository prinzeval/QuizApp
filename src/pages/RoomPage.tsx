import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "../hooks/useIsMobile.ts";
import { FormModal } from "../components/FormModal.tsx";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Badge,
  Button,
  Card,
  Center,
  EmptyState,
  Group,
  Loader,
  Modal,
  Stack,
  Tabs,
  Text,
  Title,
  VisuallyHidden,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconCards,
  IconChartBar,
  IconChevronLeft,
  IconFileText,
  IconListCheck,
  IconMessageChatbot,
  IconMessages,
  IconPencil,
  IconSparkles,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";
import { useDeleteRoom, useRoom, useRooms, useUpdateRoom } from "../hooks/rooms.ts";
import { ApiError } from "../lib/api.ts";
import { plural } from "../lib/format.ts";
import { notify } from "../notify.ts";
import { RoomForm } from "../components/RoomForm.tsx";
import { RoomAvatar } from "../components/RoomAvatar.tsx";
import { MaterialsTab } from "../features/materials/MaterialsTab.tsx";
import { StudioTab } from "../features/studio/StudioTab.tsx";
import { QuizzesTab } from "../features/quizzes/QuizzesTab.tsx";
import { TutorTab } from "../features/tutor/TutorTab.tsx";
import { ProgressTab } from "../features/progress/ProgressTab.tsx";
import { MembersTab } from "../features/members/MembersTab.tsx";
import { PresenceStack } from "../features/members/PresenceStack.tsx";
import { CallButton } from "../features/call/CallButton.tsx";
import { useRoomLive } from "../realtime/useRoomLive.ts";
import { usePageTitle } from "../hooks/usePageTitle.ts";
import { ChatPanel } from "../features/chat/ChatPanel.tsx";
import { formatUnread } from "../features/chat/chatUtils.ts";
import { FlashcardsTab } from "../features/flashcards/FlashcardsTab.tsx";
import { unreadOf } from "../lib/chatApi.ts";

const TABS = [
  { id: "materials", label: "Materials", icon: IconFileText },
  { id: "studio", label: "Studio", icon: IconSparkles },
  { id: "quizzes", label: "Quizzes", icon: IconListCheck },
  { id: "flashcards", label: "Flashcards", icon: IconCards },
  { id: "chat", label: "Chat", icon: IconMessages },
  { id: "tutor", label: "AI Tutor", icon: IconMessageChatbot },
  { id: "progress", label: "Progress", icon: IconChartBar },
  { id: "members", label: "Members", icon: IconUsers },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function RoomPage() {
  const { roomId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: TabId = TABS.some(t => t.id === tabParam) ? (tabParam as TabId) : "materials";

  const query = useRoom(roomId);
  // The room list is refreshed whenever a message arrives (user:rooms-changed), so it has the freshest unread count.
  const listed = useRooms().data?.find(r => r.id === roomId);
  usePageTitle(query.data?.room.name);
  // Live updates + who's here; runs for the whole time the room page is open.
  const present = useRoomLive(roomId);
  // Icons only where there's room for them; on phones the tab list scrolls sideways.
  const mobile = useIsMobile();
  const tabList = useRef<HTMLDivElement>(null);

  // Keep the active tab in view when the list scrolls (e.g. opening ?tab=members on a phone).
  useEffect(() => {
    tabList.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [tab, query.isSuccess]);
  // Opening the chat: bring it up to fill the screen, so the message box is in view.
  useEffect(() => {
    if (tab !== "chat" || !query.isSuccess) return;
    const align = (behavior: ScrollBehavior) => {
      if (!tabList.current) return;
      const top = tabList.current.getBoundingClientRect().top + window.scrollY - (mobile ? 56 : 0) - 8;
      window.scrollTo({ top: Math.max(0, top), behavior });
    };
    align("smooth");
    // The header can grow a moment later (who's here, the call button): line up again
    // for a few seconds, unless you've started scrolling yourself.
    const observer = new ResizeObserver(() => align("auto"));
    observer.observe(document.body);
    const stop = () => {
      observer.disconnect();
      clearTimeout(expire);
    };
    const expire = setTimeout(stop, 5000);
    window.addEventListener("wheel", stop, { once: true, passive: true });
    window.addEventListener("touchstart", stop, { once: true, passive: true });
    window.addEventListener("keydown", stop, { once: true });
    return () => {
      stop();
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [tab, query.isSuccess, mobile]);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (query.isPending) {
    return (
      <Center py={96} role="status">
        <Loader aria-hidden="true" />
        <VisuallyHidden>Loading room…</VisuallyHidden>
      </Center>
    );
  }

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <EmptyState
        title={notFound ? "Room not found" : "Couldn't load this room"}
        description={notFound ? "It may have been deleted, or you're not a member." : query.error.message}
        py={56}
        bd="1px dashed var(--mantine-color-default-border)"
        bdrs="lg"
      >
        <EmptyState.Actions>
          <Button component={Link} to="/" variant="default">
            Back to your rooms
          </Button>
        </EmptyState.Actions>
      </EmptyState>
    );
  }

  const { room, members } = query.data;
  const isOwner = room.role === "owner";
  const unread = tab === "chat" ? 0 : unreadOf(listed ?? room);

  return (
    <>
      <Button component={Link} to="/" variant="subtle" color="gray" c="dimmed" fw={500} px={8} ml={-8} mb="md" leftSection={<IconChevronLeft size={16} aria-hidden="true" />}>
        All rooms
      </Button>

      <Group align="flex-start" gap="md" wrap="nowrap" mb="xl">
        <RoomAvatar room={room} size={56} />
        <Stack gap={4} flex={1} miw={0}>
          <Title order={1} style={{ overflowWrap: "anywhere" }}>
            {room.name}
          </Title>
          {room.description && <Text c="dimmed">{room.description}</Text>}
          <Group gap="sm" wrap="wrap">
            <Text size="sm" c="dimmed">
              {plural(room.memberCount, "member")} · You're {isOwner ? "the owner" : "a member"}
            </Text>
            <PresenceStack present={present} />
            <CallButton roomId={room.id} roomName={room.name} />
          </Group>
        </Stack>
        {isOwner && (
          <Group gap="xs" wrap="nowrap" visibleFrom="xs">
            <Button variant="default" leftSection={<IconPencil size={16} />} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="light" color="red" leftSection={<IconTrash size={16} />} onClick={() => setDeleting(true)}>
              Delete
            </Button>
          </Group>
        )}
      </Group>
      {isOwner && (
        <Group gap="xs" hiddenFrom="xs" mt={-8} mb="lg">
          <Button variant="default" leftSection={<IconPencil size={16} />} onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="light" color="red" leftSection={<IconTrash size={16} />} onClick={() => setDeleting(true)}>
            Delete
          </Button>
        </Group>
      )}

      <Tabs
        value={tab}
        onChange={value => setSearchParams(!value || value === "materials" ? {} : { tab: value }, { replace: true })}
        keepMounted={false}
      >
        <Tabs.List ref={tabList} aria-label="Room sections" style={{ flexWrap: "nowrap", overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none" }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <Tabs.Tab
              key={id}
              value={id}
              leftSection={mobile ? null : <Icon size={16} stroke={1.8} />}
              rightSection={
                id === "members" ? (
                  <Badge size="xs" variant="light" circle aria-label={`${room.memberCount}`}>
                    {room.memberCount}
                  </Badge>
                ) : id === "chat" && unread > 0 ? (
                  <Badge size="xs" variant="filled" color="red" circle={unread < 10} aria-label={`${unread} unread`} data-testid="chat-unread">
                    {formatUnread(unread)}
                  </Badge>
                ) : null
              }
              px={mobile ? "sm" : "md"}
              style={{ flexShrink: 0 }}
            >
              {label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel value="materials" pt="lg">
          <MaterialsTab room={room} />
        </Tabs.Panel>
        <Tabs.Panel value="studio" pt="lg">
          <StudioTab room={room} />
        </Tabs.Panel>
        <Tabs.Panel value="quizzes" pt="lg">
          <QuizzesTab room={room} />
        </Tabs.Panel>
        <Tabs.Panel value="flashcards" pt="lg">
          <FlashcardsTab room={room} />
        </Tabs.Panel>
        <Tabs.Panel value="chat" pt="lg">
          <Card padding={0} h={{ base: "calc(100dvh - 136px)", sm: "calc(100dvh - 104px)" }} mih={380} mah={900} style={{ overflow: "hidden" }}>
            <ChatPanel roomId={room.id} roomName={room.name} isOwner={isOwner} />
          </Card>
        </Tabs.Panel>
        <Tabs.Panel value="tutor" pt="lg">
          <TutorTab room={room} />
        </Tabs.Panel>
        <Tabs.Panel value="progress" pt="lg">
          <ProgressTab room={room} />
        </Tabs.Panel>
        <Tabs.Panel value="members" pt="lg">
          <MembersTab room={room} members={members} present={present} />
        </Tabs.Panel>
      </Tabs>

      <FormModal opened={editing} onClose={() => setEditing(false)} title="Edit room">
        <EditRoom roomId={room.id} initial={{ name: room.name, description: room.description }} onDone={() => setEditing(false)} />
      </FormModal>

      <Modal opened={deleting} onClose={() => setDeleting(false)} title="Delete this room?">
        <DeleteRoom roomId={room.id} name={room.name} memberCount={room.memberCount} onCancel={() => setDeleting(false)} />
      </Modal>
    </>
  );
}

function EditRoom({ roomId, initial, onDone }: { roomId: string; initial: { name: string; description: string }; onDone: () => void }) {
  const updateRoom = useUpdateRoom(roomId);
  return (
    <RoomForm
      initial={initial}
      submitLabel="Save changes"
      onCancel={onDone}
      onSubmit={async input => {
        await updateRoom.mutateAsync(input);
        onDone();
        notify("Room updated");
      }}
    />
  );
}

function DeleteRoom({ roomId, name, memberCount, onCancel }: { roomId: string; name: string; memberCount: number; onCancel: () => void }) {
  const deleteRoom = useDeleteRoom(roomId);
  const navigate = useNavigate();

  return (
    <Stack gap="md">
      {deleteRoom.isError && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
          {deleteRoom.error.message}
        </Alert>
      )}
      <Text size="sm">
        <strong>{name}</strong> and everything in it will be permanently deleted
        {memberCount > 1 ? ` for all ${memberCount} members` : ""}. This can't be undone.
      </Text>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          color="red"
          loading={deleteRoom.isPending}
          onClick={async () => {
            await deleteRoom.mutateAsync();
            navigate("/", { replace: true });
            notify(`Deleted "${name}"`);
          }}
        >
          Delete room
        </Button>
      </Group>
    </Stack>
  );
}
