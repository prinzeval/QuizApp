import { useEffect, useRef } from "react";
import { Button, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPhoneCall } from "@tabler/icons-react";
import { useAuth } from "../../auth/AuthContext.tsx";
import type { CallParticipant } from "../../lib/callApi.ts";
import { ringIncomingCall } from "./callSounds.ts";

// Long enough to notice and answer; the chimes stop sooner.
const RING_ALERT_MS = 15_000;

/**
 * Rings (a few soft chimes and an alert with a Join button) when someone else starts a call in the
 * room you're looking at. Only the moment a call starts rings: not opening a
 * room where a call is already going, and never for a call you're in.
 */
export function useIncomingCallRing({
  roomId,
  roomName,
  participants,
  inThisCall,
  onJoin,
}: {
  roomId: string;
  roomName: string;
  participants: CallParticipant[] | undefined;
  inThisCall: boolean;
  /** Opens the join dialog (from the alert's Join button). */
  onJoin: () => void;
}) {
  const { user } = useAuth();
  const previous = useRef<number | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const count = participants?.length;
  const alertId = `incoming-call-${roomId}`;

  useEffect(() => {
    if (count === undefined) return;
    const before = previous.current;
    previous.current = count;
    const starter = participants?.find(person => person.userId !== user?.id);
    if (before === 0 && count > 0 && starter && !inThisCall) {
      stop.current?.();
      stop.current = ringIncomingCall();
      notifications.show({
        id: alertId,
        color: "teal",
        withBorder: true,
        autoClose: RING_ALERT_MS,
        icon: <IconPhoneCall size={18} />,
        title: `${starter.name} started a call`,
        message: (
          <Group justify="space-between" gap="sm" wrap="nowrap" mt={4}>
            <Text size="sm" c="dimmed" lineClamp={1}>
              {roomName}
            </Text>
            <Button
              size="xs"
              color="teal"
              data-testid="incoming-call-join"
              onClick={() => {
                notifications.hide(alertId);
                onJoin();
              }}
            >
              Join
            </Button>
          </Group>
        ),
        onClose: () => stop.current?.(),
      });
    }
    // Answered, or everyone left: stop ringing.
    if (inThisCall || count === 0) {
      stop.current?.();
      stop.current = null;
      notifications.hide(alertId);
    }
  }, [count, participants, inThisCall, roomName, user?.id, alertId, onJoin]);

  useEffect(() => () => stop.current?.(), []);
}
