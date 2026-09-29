import { useState } from "react";
import {
  Alert,
  Button,
  CopyButton,
  Divider,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconAlertCircle, IconCheck, IconCopy, IconInfoCircle, IconLink, IconPlus, IconShare } from "@tabler/icons-react";
import { ApiError, type Room } from "../../lib/api.ts";
import type { Invite } from "../../lib/learningApi.ts";
import { plural, timeAgo } from "../../lib/format.ts";
import { useCreateInvite, useInvites, useRevokeInvite } from "../../hooks/learning.ts";
import { notify } from "../../notify.ts";
import { FormModal } from "../../components/FormModal.tsx";

type Expiry = "1" | "7" | "30" | "never";

const EXPIRY_OPTIONS: { value: Expiry; label: string }[] = [
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "never", label: "Never" },
];

export const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`;

export function InviteModal({ room, opened, onClose }: { room: Room; opened: boolean; onClose: () => void }) {
  return (
    <FormModal opened={opened} onClose={onClose} title={<Text fw={600}>Invite people to {room.name}</Text>} size="lg">
      <InviteContent room={room} />
    </FormModal>
  );
}

function InviteContent({ room }: { room: Room }) {
  const createInvite = useCreateInvite(room.id);
  const [expiry, setExpiry] = useState<Expiry>("7");
  const [maxUses, setMaxUses] = useState<number | string>("");
  const [created, setCreated] = useState<string | null>(null);

  const fieldError = createInvite.error instanceof ApiError ? createInvite.error.fieldErrors.maxUses : undefined;

  const create = () =>
    createInvite.mutate(
      {
        expiresInDays: expiry === "never" ? null : (Number(expiry) as 1 | 7 | 30),
        maxUses: typeof maxUses === "number" ? maxUses : null,
      },
      { onSuccess: ({ token }) => setCreated(inviteUrl(token)) },
    );

  return (
    <Stack gap="lg">
      {created ? (
        <CreatedLink url={created} roomName={room.name} onAnother={() => setCreated(null)} />
      ) : (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Anyone with the link can join this room and see its materials and quizzes.
          </Text>
          <Stack gap={6}>
            <Text size="sm" fw={500} id="invite-expiry-label">
              Link expires after
            </Text>
            <SegmentedControl aria-labelledby="invite-expiry-label" data={EXPIRY_OPTIONS} value={expiry} onChange={value => setExpiry(value as Expiry)} fullWidth />
          </Stack>
          <NumberInput
            label="Maximum uses"
            description="Leave empty to let any number of people join."
            placeholder="No limit"
            min={1}
            max={1000}
            allowDecimal={false}
            allowNegative={false}
            value={maxUses}
            onChange={setMaxUses}
            error={fieldError}
          />
          {createInvite.isError && !fieldError && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
              {createInvite.error.message}
            </Alert>
          )}
          <Button leftSection={<IconLink size={16} />} loading={createInvite.isPending} onClick={create} fullWidth>
            Create link
          </Button>
        </Stack>
      )}

      <Divider />
      <ActiveLinks roomId={room.id} />
    </Stack>
  );
}

function CreatedLink({ url, roomName, onAnother }: { url: string; roomName: string; onAnother: () => void }) {
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <Stack gap="sm">
      <Group gap={8} c="teal">
        <IconCheck size={18} />
        <Text fw={600} c="var(--mantine-color-text)">
          Your invite link is ready
        </Text>
      </Group>
      <Paper withBorder p="sm" radius="md" bg="var(--mantine-color-default-hover)">
        <Text data-testid="invite-link" ff="monospace" size="sm" style={{ overflowWrap: "anywhere", userSelect: "all" }}>
          {url}
        </Text>
      </Paper>
      <Group gap="xs" grow>
        <CopyButton value={url} timeout={2500}>
          {({ copied, copy }) => (
            <Button
              data-testid="copy-invite"
              color={copied ? "teal" : undefined}
              leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              onClick={copy}
            >
              {copied ? "Copied" : "Copy link"}
            </Button>
          )}
        </CopyButton>
        {canShare && (
          <Button
            variant="default"
            leftSection={<IconShare size={16} />}
            onClick={() => navigator.share({ title: `Join ${roomName} on SmartQuiz`, url }).catch(() => undefined)}
          >
            Share
          </Button>
        )}
      </Group>
      <Group gap={6} wrap="nowrap" align="flex-start">
        <IconInfoCircle size={16} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0, marginTop: 2 }} />
        <Text size="xs" c="dimmed">
          Copy it now. For security we only show the full link once; afterwards you'll see just its first few characters.
        </Text>
      </Group>
      <Button variant="subtle" leftSection={<IconPlus size={16} />} onClick={onAnother} style={{ alignSelf: "flex-start" }}>
        Create another link
      </Button>
    </Stack>
  );
}

function ActiveLinks({ roomId }: { roomId: string }) {
  const invites = useInvites(roomId);
  return (
    <Stack gap="sm">
      <Group justify="space-between" gap="xs">
        <Title order={3} fz="sm" ff="inherit" fw={600}>
          Active links
        </Title>
        {invites.data && invites.data.invites.length > 0 && (
          <Text size="xs" c="dimmed">
            {invites.data.invites.length}
          </Text>
        )}
      </Group>
      {invites.isPending ? (
        <Skeleton h={56} />
      ) : invites.isError ? (
        <Text size="sm" c="red">
          {invites.error.message}
        </Text>
      ) : invites.data.invites.length === 0 ? (
        <Text size="sm" c="dimmed">
          No active links. Links stop working when they expire, run out of uses, or you revoke them.
        </Text>
      ) : (
        <Paper withBorder component="ul" p={0} m={0} radius="md" style={{ listStyle: "none", overflow: "hidden" }}>
          {invites.data.invites.map((invite, index) => (
            <InviteRow key={invite.id} roomId={roomId} invite={invite} first={index === 0} />
          ))}
        </Paper>
      )}
    </Stack>
  );
}

function InviteRow({ roomId, invite, first }: { roomId: string; invite: Invite; first: boolean }) {
  const revoke = useRevokeInvite(roomId);
  const [confirming, setConfirming] = useState(false);
  const uses = invite.maxUses == null ? `${plural(invite.useCount, "use")}, no limit` : `${invite.useCount} of ${invite.maxUses} uses`;
  const expires = invite.expiresAt ? `Expires ${timeAgo(invite.expiresAt)}` : "Never expires";

  return (
    <Stack component="li" data-testid="invite-row" gap={8} px="md" py="sm" style={first ? undefined : { borderTop: "1px solid var(--mantine-color-default-border)" }}>
      <Group justify="space-between" gap="sm" wrap="nowrap">
        <Stack gap={2} miw={0}>
          <Text size="sm" ff="monospace" fw={500}>
            …/invite/{invite.tokenPrefix}…
          </Text>
          <Text size="xs" c="dimmed">
            {uses} · {expires}
          </Text>
          <Text size="xs" c="dimmed">
            Created {invite.createdByName ? `by ${invite.createdByName} ` : ""}
            {timeAgo(invite.createdAt)}
          </Text>
        </Stack>
        {!confirming && (
          <Button size="xs" variant="subtle" color="red" onClick={() => setConfirming(true)} style={{ flexShrink: 0 }}>
            Revoke
          </Button>
        )}
      </Group>
      {confirming && (
        <Group justify="space-between" gap="xs" p="xs" bg="var(--mantine-color-red-light)" style={{ borderRadius: "var(--mantine-radius-md)" }}>
          <Text size="xs" flex={1} miw={160}>
            Revoke this link? Anyone who has it won't be able to join.
          </Text>
          <Group gap="xs" wrap="nowrap">
            <Button size="xs" variant="default" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              size="xs"
              color="red"
              loading={revoke.isPending}
              onClick={() =>
                revoke.mutate(invite.id, {
                  onSuccess: () => notify("Link revoked"),
                  onError: error => notify(error.message, "error"),
                })
              }
            >
              Revoke link
            </Button>
          </Group>
        </Group>
      )}
    </Stack>
  );
}
