import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Alert, Anchor, Box, Button, Card, Center, Group, Image, Skeleton, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconAlertCircle, IconClockOff, IconLinkOff, IconUsers } from "@tabler/icons-react";
import { useAuth } from "../../auth/AuthContext.tsx";
import { useAcceptInvite, useInvitePreview } from "../../hooks/learning.ts";
import { ApiError } from "../../lib/api.ts";
import type { InvitePreview, InviteStatus } from "../../lib/learningApi.ts";
import { formatDate, plural } from "../../lib/format.ts";
import { notify } from "../../notify.ts";
import { RoomAvatar } from "../../components/RoomAvatar.tsx";
import { UserAvatar } from "../../components/UserAvatar.tsx";

/** Public page behind an invite link. Works logged in (join) or out (log in / sign up, then come back here). */
export function InvitePage() {
  const { token = "" } = useParams();
  const preview = useInvitePreview(token);

  return (
    <Center component="main" mih="100dvh" bg="var(--app-canvas)" px="md" py={40} data-testid="invite-page">
      <Stack w="100%" maw={440} gap="lg">
        <Anchor component={Link} to="/" underline="never" c="inherit" style={{ alignSelf: "center" }} aria-label="SmartQuiz home">
          <Group gap={10} wrap="nowrap">
            <Image src="/favicon.jpg" alt="" w={32} h={32} radius="md" />
            <Text fw={700} size="lg">
              SmartQuiz
            </Text>
          </Group>
        </Anchor>
        <Card shadow="sm" padding="xl">
          {preview.isPending ? (
            <LoadingCard />
          ) : preview.isError ? (
            preview.error instanceof ApiError && preview.error.status === 404 ? (
              <Problem
                icon={<IconLinkOff size={26} />}
                title="This invite link doesn't exist"
                message="Check that you copied the whole link, or ask whoever sent it for a new one."
              />
            ) : (
              <Problem
                icon={<IconAlertCircle size={26} />}
                title="Couldn't load this invite"
                message={preview.error.message}
                action={
                  <Button variant="default" onClick={() => preview.refetch()}>
                    Try again
                  </Button>
                }
              />
            )
          ) : (
            <InviteCard token={token} invite={preview.data.invite} />
          )}
        </Card>
      </Stack>
    </Center>
  );
}

function LoadingCard() {
  return (
    <Stack align="center" gap="sm" aria-busy="true" aria-label="Loading invite">
      <Skeleton h={64} w={64} radius="md" />
      <Skeleton h={14} w="40%" mt="xs" />
      <Skeleton h={28} w="70%" />
      <Skeleton h={14} w="85%" />
      <Skeleton h={44} mt="md" />
    </Stack>
  );
}

function Problem({ icon, title, message, action }: { icon: ReactNode; title: string; message: string; action?: ReactNode }) {
  return (
    <Stack align="center" gap="sm" ta="center">
      <ThemeIcon size={56} radius="xl" variant="light" color="gray">
        {icon}
      </ThemeIcon>
      <Title order={1} fz={24}>
        {title}
      </Title>
      <Text c="dimmed">{message}</Text>
      <Group justify="center" mt="sm" gap="sm">
        {action}
        <Button component={Link} to="/" variant={action ? "subtle" : "default"}>
          Go to SmartQuiz
        </Button>
      </Group>
    </Stack>
  );
}

const DEAD_LINK: Record<Exclude<InviteStatus, "valid">, { title: string; expired?: boolean; message: (invite: InvitePreview) => string }> = {
  expired: {
    expired: true,
    title: "This invite link has expired",
    message: invite => `It stopped working${invite.expiresAt ? ` on ${formatDate(invite.expiresAt)}` : ""}.`,
  },
  revoked: { title: "This invite link was turned off", message: () => "The room owner revoked it." },
  used_up: { title: "This invite link has been used up", message: () => "It already let in as many people as it allows." },
};

function InviteCard({ token, invite }: { token: string; invite: InvitePreview }) {
  const { status: authStatus, user, logout } = useAuth();
  const accept = useAcceptInvite();
  const navigate = useNavigate();
  const from = `/invite/${token}`;
  const { room, invitedBy } = invite;
  const dead = invite.status === "valid" ? null : DEAD_LINK[invite.status];

  const join = () =>
    accept.mutate(token, {
      onSuccess: ({ roomId, alreadyMember }) => {
        navigate(`/rooms/${roomId}`, { replace: true });
        notify(alreadyMember ? "You're already in this room" : `You joined "${room.name}"`, alreadyMember ? "info" : "success");
      },
    });

  return (
    <Stack gap="lg">
      <Stack align="center" gap={6} ta="center">
        <RoomAvatar room={room} size={64} />
        <Text size="sm" c="dimmed" mt={6}>
          {dead ? "Invitation to join" : "You're invited to join"}
        </Text>
        <Title order={1} fz={26} style={{ overflowWrap: "anywhere" }}>
          {room.name}
        </Title>
        {room.description && (
          <Text c="dimmed" size="sm" lineClamp={3}>
            {room.description}
          </Text>
        )}
        <Group gap={6} c="dimmed" mt={2}>
          <IconUsers size={16} aria-hidden="true" />
          <Text size="sm">{plural(room.memberCount, "member")}</Text>
        </Group>
      </Stack>

      {invitedBy && (
        <Group gap="sm" justify="center" wrap="nowrap" py="sm" style={{ borderTop: "1px solid var(--mantine-color-default-border)", borderBottom: "1px solid var(--mantine-color-default-border)" }}>
          <UserAvatar name={invitedBy.name} url={invitedBy.avatarUrl} size={32} />
          <Text size="sm" truncate="end">
            Invited by <strong>{invitedBy.name}</strong>
          </Text>
        </Group>
      )}

      {dead ? (
        <Alert color="orange" variant="light" icon={dead.expired ? <IconClockOff size={18} /> : <IconLinkOff size={18} />} title={dead.title} data-testid="invite-dead">
          <Text size="sm">
            {dead.message(invite)} Ask {invitedBy ? invitedBy.name : "the room owner"} for a new link.
          </Text>
        </Alert>
      ) : authStatus === "loading" ? (
        <Skeleton h={44} />
      ) : authStatus === "authenticated" && user ? (
        <Stack gap="sm">
          {accept.isError && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
              {accept.error.message}
            </Alert>
          )}
          <Button size="md" fullWidth loading={accept.isPending} onClick={join}>
            Join room
          </Button>
          <Text size="xs" c="dimmed" ta="center">
            Joining as {user.email} ·{" "}
            <Anchor component="button" type="button" size="xs" onClick={logout}>
              Not you?
            </Anchor>
          </Text>
        </Stack>
      ) : (
        <Stack gap="sm">
          <Button size="md" fullWidth component={Link} to="/signup" state={{ from }}>
            Create an account
          </Button>
          <Button size="md" fullWidth variant="default" component={Link} to="/login" state={{ from }}>
            Log in to join
          </Button>
          <Box>
            <Text size="xs" c="dimmed" ta="center">
              You'll come straight back here to join.
            </Text>
          </Box>
        </Stack>
      )}
    </Stack>
  );
}
