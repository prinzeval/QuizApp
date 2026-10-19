import { Link } from "react-router-dom";
import { ActionIcon, Anchor, Avatar, Badge, Box, Button, Center, Group, Modal, Paper, ScrollArea, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { useAudioPlayback, useConnectionState, useParticipants } from "@livekit/components-react";
import { ConnectionState, type Participant } from "livekit-client";
import { IconArrowsMaximize, IconArrowsMinimize, IconChevronUp, IconMinus, IconVolume } from "@tabler/icons-react";
import { useIsMobile } from "../../hooks/useIsMobile.ts";
import { initials } from "../../lib/format.ts";
import { useCall, type ActiveCall } from "./callContext.ts";
import { MOBILE_BAR_HEIGHT } from "./CallSpacer.tsx";
import { gridColumns, splitStage } from "./callUtils.ts";
import { CallControls, CameraToggle, LeaveButton, MicToggle } from "./CallControls.tsx";
import { ParticipantTile } from "./ParticipantTile.tsx";
import { useCallTiles, useProfileOf, type Profile, type Tile } from "./useCallTiles.ts";

const DOCK_WIDTH = 320;
/** Above page content, just below the app shell (100) so the phone nav drawer covers the call bar. */
const DOCK_Z = 99;

type ProfileOf = (participant: Participant) => Profile;

/** Picks the call's presentation: desktop dock / pill, phone bar, and the full view. */
export function CallSurface({ call }: { call: ActiveCall }) {
  const { view, setView, leave } = useCall();
  const mobile = useIsMobile();
  const profileOf = useProfileOf(call.roomId);
  const onLeave = () => void leave();

  return (
    <>
      {view !== "full" &&
        (mobile ? (
          <MobileBar call={call} profileOf={profileOf} onOpen={() => setView("full")} onLeave={onLeave} />
        ) : view === "pill" ? (
          <Pill call={call} onRestore={() => setView("dock")} />
        ) : (
          <Dock call={call} profileOf={profileOf} onExpand={() => setView("full")} onMinimize={() => setView("pill")} onLeave={onLeave} />
        ))}
      <Stage call={call} profileOf={profileOf} opened={view === "full"} onCollapse={() => setView("dock")} onLeave={onLeave} />
    </>
  );
}

function LiveDot() {
  return (
    <span
      aria-hidden="true"
      style={{ flexShrink: 0, width: 8, height: 8, borderRadius: "50%", background: "var(--mantine-color-teal-6)", boxShadow: "0 0 0 3px var(--mantine-color-teal-light)" }}
    />
  );
}

/** "Connecting…" / "Reconnecting…" while LiveKit isn't fully connected. */
function ConnectionBadge() {
  const state = useConnectionState();
  if (state === ConnectionState.Connected) return null;
  const reconnecting = state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting;
  return (
    <Badge size="sm" variant="light" color={reconnecting ? "yellow" : "gray"} style={{ flexShrink: 0 }}>
      {reconnecting ? "Reconnecting…" : state === ConnectionState.Connecting ? "Connecting…" : "Offline"}
    </Badge>
  );
}

/** Browsers can block audio that didn't start from a click; this is the click. */
function AudioUnblock({ fullWidth = false }: { fullWidth?: boolean }) {
  const { canPlayAudio, startAudio } = useAudioPlayback();
  if (canPlayAudio) return null;
  return (
    <Button size="xs" variant="light" color="yellow" fullWidth={fullWidth} leftSection={<IconVolume size={14} />} onClick={() => void startAudio()}>
      Turn on call audio
    </Button>
  );
}

function PeopleStack({ participants, profileOf, max = 3 }: { participants: Participant[]; profileOf: ProfileOf; max?: number }) {
  const shown = participants.slice(0, max);
  return (
    <Avatar.Group spacing={8} aria-hidden="true" style={{ flexShrink: 0 }}>
      {shown.map(participant => {
        const { name, avatarUrl } = profileOf(participant);
        return (
          <Avatar key={participant.identity} src={avatarUrl} size={28} radius="xl" color="clay" alt="">
            {initials(name)}
          </Avatar>
        );
      })}
      {participants.length > shown.length && (
        <Avatar size={28} radius="xl">
          +{participants.length - shown.length}
        </Avatar>
      )}
    </Avatar.Group>
  );
}

const fixedCorner = { position: "fixed", right: 16, bottom: 16, zIndex: DOCK_Z } as const;

/** Desktop: a compact card in the bottom-right corner with a few tiles and the controls. */
function Dock({ call, profileOf, onExpand, onMinimize, onLeave }: { call: ActiveCall; profileOf: ProfileOf; onExpand: () => void; onMinimize: () => void; onLeave: () => void }) {
  const tiles = useCallTiles();
  const shown = tiles.slice(0, tiles.length > 4 ? 3 : 4);
  const hidden = tiles.length - shown.length;
  const tileHeight = tiles.length <= 2 ? 120 : 84;

  return (
    <Paper component="section" aria-label={`Call in ${call.roomName}`} shadow="lg" withBorder p="sm" w={DOCK_WIDTH} maw="calc(100vw - 32px)" style={fixedCorner}>
      <Group justify="space-between" wrap="nowrap" gap="xs" mb="xs">
        <Group gap={8} wrap="nowrap" miw={0}>
          <LiveDot />
          <Stack gap={0} miw={0}>
            <Text size="xs" c="dimmed" lh={1.2}>
              In call
            </Text>
            <Anchor component={Link} to={`/rooms/${call.roomId}`} size="sm" fw={600} c="var(--mantine-color-text)" truncate title={call.roomName}>
              {call.roomName}
            </Anchor>
          </Stack>
        </Group>
        <Group gap={2} wrap="nowrap">
          <ConnectionBadge />
          <Tooltip label="Expand call" withArrow>
            <ActionIcon variant="subtle" color="gray" aria-label="Expand call" onClick={onExpand}>
              <IconArrowsMaximize size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Minimize" withArrow>
            <ActionIcon variant="subtle" color="gray" aria-label="Minimize call" onClick={onMinimize}>
              <IconMinus size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Box style={{ display: "grid", gridTemplateColumns: tiles.length === 1 ? "1fr" : "1fr 1fr", gap: 6 }}>
        {shown.map(tile => (
          <ParticipantTile key={tile.id} tile={tile} profile={profileOf(tile.trackRef.participant)} compact h={tileHeight} />
        ))}
        {hidden > 0 && (
          <UnstyledButton onClick={onExpand} aria-label={`Show ${hidden} more`} h={tileHeight} bg="var(--mantine-color-default-hover)" style={{ borderRadius: "var(--mantine-radius-md)" }}>
            <Center h="100%">
              <Text fw={600}>+{hidden}</Text>
            </Center>
          </UnstyledButton>
        )}
      </Box>

      <Stack gap="xs" mt="sm">
        <AudioUnblock fullWidth />
        <CallControls onLeave={onLeave} size={38} />
      </Stack>
    </Paper>
  );
}

/** Desktop, minimized: "In call · 3" with a mic button, out of the way of the page. */
function Pill({ call, onRestore }: { call: ActiveCall; onRestore: () => void }) {
  const count = useParticipants().length;
  return (
    <Paper component="section" aria-label={`Call in ${call.roomName} (minimized)`} shadow="lg" withBorder radius="xl" py={6} pl="md" pr={6} style={fixedCorner}>
      <Group gap="sm" wrap="nowrap">
        <UnstyledButton onClick={onRestore} aria-label={`Show call in ${call.roomName}`}>
          <Group gap={8} wrap="nowrap">
            <LiveDot />
            <Text size="sm" fw={600}>
              In call · {count}
            </Text>
            <ConnectionBadge />
            <IconChevronUp size={16} aria-hidden="true" />
          </Group>
        </UnstyledButton>
        <AudioUnblock />
        <MicToggle size={34} />
      </Group>
    </Paper>
  );
}

/** Phones: a bar along the bottom edge; tap it for the full view. */
function MobileBar({ call, profileOf, onOpen, onLeave }: { call: ActiveCall; profileOf: ProfileOf; onOpen: () => void; onLeave: () => void }) {
  const participants = useParticipants();
  return (
    <Paper
      component="section"
      aria-label={`Call in ${call.roomName}`}
      shadow="lg"
      radius={0}
      px="sm"
      pt={8}
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: DOCK_Z,
        borderTop: "1px solid var(--mantine-color-default-border)",
        paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
      }}
    >
      <Stack gap={6}>
        <AudioUnblock fullWidth />
        <Group gap="xs" wrap="nowrap" h={MOBILE_BAR_HEIGHT - 16}>
          <UnstyledButton onClick={onOpen} aria-label={`Open call in ${call.roomName}`} flex={1} miw={0} h="100%">
            <Group gap="xs" wrap="nowrap" miw={0}>
              <PeopleStack participants={participants} profileOf={profileOf} max={2} />
              <Stack gap={0} miw={0}>
                <Group gap={6} wrap="nowrap">
                  <LiveDot />
                  <Text size="sm" fw={600} style={{ whiteSpace: "nowrap" }}>
                    In call · {participants.length}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" truncate>
                  {call.roomName}
                </Text>
              </Stack>
            </Group>
          </UnstyledButton>
          <MicToggle size={40} />
          <CameraToggle size={40} />
          <LeaveButton size={40} onLeave={onLeave} />
        </Group>
      </Stack>
    </Paper>
  );
}

/** The big view: an even grid of tiles, or a screen share large with everyone else beside it. */
function Stage({ call, profileOf, opened, onCollapse, onLeave }: { call: ActiveCall; profileOf: ProfileOf; opened: boolean; onCollapse: () => void; onLeave: () => void }) {
  const mobile = useIsMobile();
  const count = useParticipants().length;

  return (
    <Modal.Root opened={opened} onClose={onCollapse} fullScreen transitionProps={{ transition: "fade", duration: 120 }}>
      <Modal.Overlay />
      <Modal.Content bg="dark.9" c="dark.0" radius={0}>
        <Stack h="100dvh" gap={0}>
          <Group justify="space-between" wrap="nowrap" px={{ base: "sm", sm: "lg" }} py="sm" gap="sm">
            <Group gap="sm" wrap="nowrap" miw={0}>
              <LiveDot />
              <Stack gap={0} miw={0}>
                <Modal.Title fw={600} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {call.roomName}
                </Modal.Title>
                <Text size="xs" c="dark.2">
                  {count} in call
                </Text>
              </Stack>
              <ConnectionBadge />
            </Group>
            <Button variant="default" size="xs" leftSection={<IconArrowsMinimize size={14} />} onClick={onCollapse} style={{ flexShrink: 0 }} data-autofocus>
              Collapse
            </Button>
          </Group>

          {opened && <StageTiles profileOf={profileOf} mobile={mobile} />}

          <Stack gap="xs" align="center" px="sm" pt="sm" pb="calc(var(--mantine-spacing-md) + env(safe-area-inset-bottom))">
            <AudioUnblock />
            <CallControls onLeave={onLeave} size={mobile ? 48 : 52} screenShare={!mobile} gap={mobile ? "sm" : "md"} />
          </Stack>
        </Stack>
      </Modal.Content>
    </Modal.Root>
  );
}

function StageTiles({ profileOf, mobile }: { profileOf: ProfileOf; mobile: boolean }) {
  const tiles = useCallTiles();
  const { main, others } = splitStage(tiles);
  const tile = (t: Tile, compact = false) => <ParticipantTile key={t.id} tile={t} profile={profileOf(t.trackRef.participant)} compact={compact} h="100%" />;

  if (main) {
    // Screen share big; everyone else in a strip (beside it on desktop, below on phones).
    return (
      <Box flex={1} mih={0} px={{ base: "sm", sm: "lg" }} style={{ display: "flex", flexDirection: mobile ? "column" : "row", gap: 8 }}>
        <ParticipantTile tile={main} profile={profileOf(main.trackRef.participant)} flex={1} mih={0} miw={0} />
        {others.length > 0 && (
          <ScrollArea w={mobile ? "100%" : 220} h={mobile ? 104 : undefined} style={{ flexShrink: 0 }} type="auto" offsetScrollbars>
            <Box style={{ display: "flex", flexDirection: mobile ? "row" : "column", gap: 8 }}>
              {others.map(t => (
                <Box key={t.id} w={mobile ? 150 : "100%"} h={mobile ? 92 : 124} style={{ flexShrink: 0 }}>
                  {tile(t, true)}
                </Box>
              ))}
            </Box>
          </ScrollArea>
        )}
      </Box>
    );
  }

  const cols = gridColumns(others.length, mobile);
  return (
    <Box
      flex={1}
      mih={0}
      px={{ base: "sm", sm: "lg" }}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridAutoRows: "minmax(120px, 1fr)",
        gap: 8,
        overflowY: "auto",
      }}
    >
      {others.map(t => tile(t, mobile && others.length > 2))}
    </Box>
  );
}
