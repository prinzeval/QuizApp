import { useCallback, useState } from "react";
import { Avatar, Button, Group, Text, Tooltip } from "@mantine/core";
import { IconPhone, IconPhoneCall } from "@tabler/icons-react";
import { initials } from "../../lib/format.ts";
import type { CallParticipant } from "../../lib/callApi.ts";
import { useCall } from "./callContext.ts";
import { callButtonLabel, inCallLabel, namesLabel, sortCallParticipants } from "./callUtils.ts";
import { PreJoinModal } from "./PreJoinModal.tsx";
import { useCallStatus } from "./useCallStatus.ts";
import { useIncomingCallRing } from "./useIncomingCallRing.tsx";

/**
 * Room header: who's in the study call (live) and a button to start / join / open it.
 * Renders nothing if the call service can't be reached, and a disabled button when
 * the server has no LiveKit keys yet, so the room page never breaks because of calls.
 */
export function CallButton({ roomId, roomName }: { roomId: string; roomName: string }) {
  const status = useCallStatus(roomId);
  const { active, setView } = useCall();
  const [preJoin, setPreJoin] = useState(false);
  const openPreJoin = useCallback(() => setPreJoin(true), []);
  useIncomingCallRing({ roomId, roomName, participants: status.data?.participants, inThisCall: active?.roomId === roomId, onJoin: openPreJoin });

  if (!status.data) return null;

  if (!status.data.configured) {
    return (
      <Tooltip label="Calls aren't set up yet" withArrow>
        {/* Disabled buttons don't fire pointer events, so the tooltip hangs off a wrapper. */}
        <span tabIndex={0} aria-label="Start call (calls aren't set up yet)">
          <Button size="xs" variant="default" disabled leftSection={<IconPhone size={14} />} style={{ pointerEvents: "none" }}>
            Start call
          </Button>
        </span>
      </Tooltip>
    );
  }

  const people = sortCallParticipants(status.data.participants);
  const inThisCall = active?.roomId === roomId;
  const label = callButtonLabel(people.length, inThisCall);

  return (
    <Group gap="sm" wrap="nowrap">
      {people.length > 0 && <InCallStack people={people} />}
      <Button
        size="xs"
        color="teal"
        variant={inThisCall ? "light" : people.length > 0 ? "filled" : "light"}
        leftSection={inThisCall ? <IconPhoneCall size={14} /> : <IconPhone size={14} />}
        onClick={() => (inThisCall ? setView("full") : setPreJoin(true))}
      >
        {label}
      </Button>
      <PreJoinModal opened={preJoin} onClose={() => setPreJoin(false)} roomId={roomId} roomName={roomName} count={people.length} />
    </Group>
  );
}

/** Green dot, up to three faces and "3 in call". */
function InCallStack({ people }: { people: CallParticipant[] }) {
  const shown = people.slice(0, 3);
  const names = namesLabel(people.map(person => person.name), 3);
  return (
    <Tooltip label={`In the call: ${names}`} withArrow multiline maw={260}>
      <Group gap={6} wrap="nowrap" data-testid="call-presence" role="img" aria-label={`${inCallLabel(people.length)}: ${names}`} tabIndex={0}>
        <span
          aria-hidden="true"
          style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--mantine-color-teal-6)", boxShadow: "0 0 0 3px var(--mantine-color-teal-light)" }}
        />
        <Avatar.Group spacing={6} aria-hidden="true">
          {shown.map(person => (
            <Avatar key={person.userId} src={person.avatarUrl} size={24} radius="xl" color="teal" alt="">
              {initials(person.name)}
            </Avatar>
          ))}
          {people.length > shown.length && (
            <Avatar size={24} radius="xl">
              +{people.length - shown.length}
            </Avatar>
          )}
        </Avatar.Group>
        <Text size="xs" fw={600} c="var(--mantine-color-teal-text)" style={{ whiteSpace: "nowrap" }} aria-hidden="true">
          {inCallLabel(people.length)}
        </Text>
      </Group>
    </Tooltip>
  );
}
