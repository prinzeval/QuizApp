import { useEffect, useRef, useState } from "react";
import { Alert, AspectRatio, Box, Button, Center, Group, Modal, Stack, Switch, Text } from "@mantine/core";
import type { LocalVideoTrack } from "livekit-client";
import { IconAlertCircle, IconMicrophone, IconVideo } from "@tabler/icons-react";
import { useAuth } from "../../auth/AuthContext.tsx";
import { UserAvatar } from "../../components/UserAvatar.tsx";
import { useCall } from "./callContext.ts";
import { reportDeviceError } from "./devices.ts";

interface PreJoinModalProps {
  opened: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  /** People already in the call: "Join" vs "Start". */
  count: number;
}

/** Choose mic / camera (with a preview) before joining. Mic starts on, camera off. */
export function PreJoinModal({ opened, onClose, roomId, roomName, count }: PreJoinModalProps) {
  const { active, join } = useCall();
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const switching = active && active.roomId !== roomId ? active : null;
  const verb = count > 0 ? "Join" : "Start";

  // A fresh start each time it opens (the mic/cam choices are kept).
  useEffect(() => {
    if (opened) setError(null);
  }, [opened]);

  const submit = async () => {
    setError(null);
    setStarting(true);
    try {
      await join({ roomId, roomName }, { mic, cam });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join the call. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={`${verb} a call in ${roomName}`}>
      <Stack gap="md">
        {switching && (
          <Alert color="yellow" variant="light" icon={<IconAlertCircle size={18} />}>
            You're in a call in <strong>{switching.roomName}</strong>. {count > 0 ? "Joining" : "Starting"} this one will leave that call.
          </Alert>
        )}

        {/* Stop the preview while joining so the call can take the camera. */}
        <CameraPreview enabled={opened && cam && !starting} onFail={() => setCam(false)} />

        <Group grow gap="sm">
          <Switch
            checked={mic}
            onChange={event => setMic(event.currentTarget.checked)}
            label="Microphone"
            description={mic ? "On" : "Muted"}
            thumbIcon={<IconMicrophone size={10} aria-hidden="true" />}
            size="md"
          />
          <Switch
            checked={cam}
            onChange={event => setCam(event.currentTarget.checked)}
            label="Camera"
            description={cam ? "On" : "Off"}
            thumbIcon={<IconVideo size={10} aria-hidden="true" />}
            size="md"
          />
        </Group>

        {error && (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
            {error}
          </Alert>
        )}

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button color="teal" loading={starting} onClick={() => void submit()} data-autofocus>
            {verb} call
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Your camera, mirrored, while the camera switch is on; your avatar otherwise. */
function CameraPreview({ enabled, onFail }: { enabled: boolean; onFail: () => void }) {
  const { user } = useAuth();
  const video = useRef<HTMLVideoElement>(null);
  const [track, setTrack] = useState<LocalVideoTrack | null>(null);
  const failRef = useRef(onFail);
  useEffect(() => {
    failRef.current = onFail;
  }, [onFail]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let created: LocalVideoTrack | null = null;
    import("livekit-client")
      .then(({ createLocalVideoTrack }) => createLocalVideoTrack())
      .then(local => {
        if (cancelled) {
          local.stop();
          return;
        }
        created = local;
        setTrack(local);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        reportDeviceError("camera", error);
        failRef.current();
      });
    return () => {
      cancelled = true;
      created?.stop();
      setTrack(null);
    };
  }, [enabled]);

  useEffect(() => {
    const element = video.current;
    if (!track || !element) return;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);

  return (
    <AspectRatio ratio={16 / 9}>
      <Box bg="dark.8" style={{ borderRadius: "var(--mantine-radius-lg)", overflow: "hidden" }}>
        {track ? (
          <video ref={video} muted playsInline aria-label="Your camera preview" style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
        ) : (
          <Center h="100%">
            <Stack align="center" gap={6}>
              <UserAvatar name={user?.name ?? ""} url={user?.avatarUrl ?? null} size={64} />
              <Text size="sm" c="dark.1">
                {enabled ? "Starting camera…" : "Camera is off"}
              </Text>
            </Stack>
          </Center>
        )}
      </Box>
    </AspectRatio>
  );
}
