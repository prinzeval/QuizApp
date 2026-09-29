import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActionIcon, Alert, Badge, Box, Button, Group, Indicator, Menu, Modal, Paper, Stack, Text } from "@mantine/core";
import { IconAlertCircle, IconDoorExit, IconDots, IconUserMinus, IconUserPlus } from "@tabler/icons-react";
import type { Room, RoomMember } from "../../lib/api.ts";
import type { PresenceUser } from "../../lib/learningApi.ts";
import { formatDate, plural } from "../../lib/format.ts";
import { useLeaveRoom, useRemoveMember } from "../../hooks/learning.ts";
import { notify } from "../../notify.ts";
import { UserAvatar } from "../../components/UserAvatar.tsx";
import { useAuth } from "../../auth/AuthContext.tsx";
import { InviteModal } from "./InviteModal.tsx";

export function MembersTab({ room, members, present }: { room: Room; members: RoomMember[]; present: PresenceUser[] }) {
  const { user } = useAuth();
  const isOwner = room.role === "owner";
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<RoomMember | null>(null);
  const [leaving, setLeaving] = useState(false);

  const online = useMemo(() => new Set(present.map(p => p.id)), [present]);
  const sorted = useMemo(
    () =>
      [...members].sort(
        (a, b) =>
          Number(b.role === "owner") - Number(a.role === "owner") ||
          Number(online.has(b.userId)) - Number(online.has(a.userId)) ||
          new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime(),
      ),
    [members, online],
  );
  const onlineCount = members.filter(m => online.has(m.userId)).length;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" gap="sm">
        <Stack gap={0} miw={0} flex="1 1 240px">
          <Text fw={600}>
            {plural(members.length, "member")}
            {onlineCount > 0 && (
              <Text span c="teal" fw={500} size="sm">
                {" "}
                · {onlineCount} online
              </Text>
            )}
          </Text>
          <Text size="sm" c="dimmed">
            Everyone here can see the room's materials and quizzes.
          </Text>
        </Stack>
        {isOwner ? (
          <Button data-testid="invite-button" leftSection={<IconUserPlus size={16} />} onClick={() => setInviting(true)}>
            Invite people
          </Button>
        ) : (
          <Button data-testid="leave-room" variant="default" color="red" leftSection={<IconDoorExit size={16} />} onClick={() => setLeaving(true)}>
            Leave room
          </Button>
        )}
      </Group>

      <Paper withBorder component="ul" p={0} m={0} style={{ listStyle: "none", overflow: "hidden" }} aria-label="Members">
        {sorted.map((member, index) => {
          const isOnline = online.has(member.userId);
          const isMe = member.userId === user?.id;
          return (
            <Group
              key={member.userId}
              component="li"
              data-testid="member-row"
              data-online={isOnline || undefined}
              gap="sm"
              wrap="nowrap"
              px="md"
              py="sm"
              mih={64}
              style={index > 0 ? { borderTop: "1px solid var(--mantine-color-default-border)" } : undefined}
            >
              <Indicator color="teal" size={11} offset={5} position="bottom-end" withBorder disabled={!isOnline} processing={false}>
                <UserAvatar name={member.name} url={member.avatarUrl} size={40} />
              </Indicator>
              <Stack gap={0} flex={1} miw={0}>
                <Text fw={600} size="sm" truncate="end" title={member.name}>
                  {member.name}
                  {isMe && (
                    <Text span c="dimmed" fw={400}>
                      {" "}
                      (you)
                    </Text>
                  )}
                </Text>
                <Text size="xs" c={isOnline ? "teal" : "dimmed"}>
                  {isOnline ? "Here now" : `Joined ${formatDate(member.joinedAt)}`}
                </Text>
              </Stack>
              <Badge variant={member.role === "owner" ? "light" : "default"} tt="none" fw={600} style={{ flexShrink: 0 }}>
                {member.role === "owner" ? "Owner" : "Member"}
              </Badge>
              {isOwner && isMe && <Box w={40} visibleFrom="xs" style={{ flexShrink: 0 }} />}
              {isOwner && !isMe && (
                <Menu position="bottom-end" withinPortal shadow="md" width={200}>
                  <Menu.Target>
                    <ActionIcon variant="subtle" color="gray" size={40} aria-label={`Options for ${member.name}`} style={{ flexShrink: 0 }}>
                      <IconDots size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item data-testid="remove-member" color="red" leftSection={<IconUserMinus size={16} />} onClick={() => setRemoving(member)}>
                      Remove from room
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              )}
            </Group>
          );
        })}
      </Paper>

      {isOwner && <InviteModal room={room} opened={inviting} onClose={() => setInviting(false)} />}

      <Modal opened={!!removing} onClose={() => setRemoving(null)} title={`Remove ${removing?.name ?? "member"}?`}>
        {removing && <RemoveMember room={room} member={removing} onDone={() => setRemoving(null)} />}
      </Modal>

      <Modal opened={leaving} onClose={() => setLeaving(false)} title="Leave this room?">
        <LeaveRoom room={room} onCancel={() => setLeaving(false)} />
      </Modal>
    </Stack>
  );
}

function RemoveMember({ room, member, onDone }: { room: Room; member: RoomMember; onDone: () => void }) {
  const remove = useRemoveMember(room.id);
  return (
    <Stack gap="md">
      {remove.isError && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
          {remove.error.message}
        </Alert>
      )}
      <Text size="sm">
        <strong>{member.name}</strong> will lose access to <strong>{room.name}</strong> straight away. Their quiz history stays, and you can invite them
        back any time.
      </Text>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onDone}>
          Cancel
        </Button>
        <Button
          color="red"
          loading={remove.isPending}
          onClick={() =>
            remove.mutate(member.userId, {
              onSuccess: () => {
                onDone();
                notify(`Removed ${member.name}`);
              },
            })
          }
        >
          Remove
        </Button>
      </Group>
    </Stack>
  );
}

function LeaveRoom({ room, onCancel }: { room: Room; onCancel: () => void }) {
  const leave = useLeaveRoom(room.id);
  const navigate = useNavigate();
  return (
    <Stack gap="md">
      {leave.isError && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
          {leave.error.message}
        </Alert>
      )}
      <Text size="sm">
        You'll lose access to <strong>{room.name}</strong> and its materials. To come back, you'll need a new invite link.
      </Text>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onCancel}>
          Stay
        </Button>
        <Button
          color="red"
          loading={leave.isPending}
          onClick={() =>
            leave.mutate(undefined, {
              onSuccess: () => {
                navigate("/", { replace: true });
                notify(`You left "${room.name}"`);
              },
            })
          }
        >
          Leave room
        </Button>
      </Group>
    </Stack>
  );
}
