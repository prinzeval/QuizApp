import { useState } from "react";
import { ActionIcon, Group, Menu, Switch, Tooltip, type MantineSize } from "@mantine/core";
import { useMediaDeviceSelect, useTrackToggle } from "@livekit/components-react";
import { supportsAudioOutputSelection, Track } from "livekit-client";
import {
  IconCheck,
  IconMicrophone,
  IconMicrophoneOff,
  IconPhoneOff,
  IconScreenShare,
  IconScreenShareOff,
  IconSettings,
  IconVolume,
  IconVolumeOff,
  IconVideo,
  IconVideoOff,
  type Icon,
} from "@tabler/icons-react";
import { callSoundsEnabled, playCallSound, setCallSoundsEnabled } from "./callSounds.ts";
import { reportDeviceError } from "./devices.ts";

/** Screen sharing needs getDisplayMedia, which phones don't have. */
const canShareScreen = typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";

interface ToggleProps {
  on: boolean;
  pending?: boolean;
  onToggle: () => void;
  onLabel: string;
  offLabel: string;
  onIcon: Icon;
  offIcon: Icon;
  size: number;
  /** "warn": off is the notable state (mic/cam, shown red). "highlight": on is (screen share). */
  tone?: "warn" | "highlight";
}

/** An on/off control: icon, tooltip and aria-label say what a press will do; aria-pressed says the state. */
function ToggleControl({ on, pending, onToggle, onLabel, offLabel, onIcon: OnIcon, offIcon: OffIcon, size, tone = "warn" }: ToggleProps) {
  const label = on ? onLabel : offLabel;
  const style =
    tone === "warn" ? (on ? { variant: "default" } : { variant: "light", color: "red" }) : on ? { variant: "filled", color: "clay" } : { variant: "default" };
  return (
    <Tooltip label={label} withArrow>
      <ActionIcon {...style} size={size} radius="xl" aria-label={label} aria-pressed={on} loading={pending} onClick={onToggle}>
        {on ? <OnIcon size={size * 0.48} /> : <OffIcon size={size * 0.48} />}
      </ActionIcon>
    </Tooltip>
  );
}

export function MicToggle({ size = 40 }: { size?: number }) {
  const mic = useTrackToggle({ source: Track.Source.Microphone, onDeviceError: error => reportDeviceError("microphone", error) });
  return (
    <ToggleControl
      on={mic.enabled}
      pending={mic.pending}
      onToggle={() => void mic.toggle()}
      onLabel="Turn microphone off"
      offLabel="Turn microphone on"
      onIcon={IconMicrophone}
      offIcon={IconMicrophoneOff}
      size={size}
    />
  );
}

export function CameraToggle({ size = 40 }: { size?: number }) {
  const cam = useTrackToggle({ source: Track.Source.Camera, onDeviceError: error => reportDeviceError("camera", error) });
  return (
    <ToggleControl
      on={cam.enabled}
      pending={cam.pending}
      onToggle={() => void cam.toggle()}
      onLabel="Turn camera off"
      offLabel="Turn camera on"
      onIcon={IconVideo}
      offIcon={IconVideoOff}
      size={size}
    />
  );
}

function ScreenShareToggle({ size }: { size: number }) {
  const screen = useTrackToggle({
    source: Track.Source.ScreenShare,
    captureOptions: { audio: true },
    onDeviceError: error => reportDeviceError("screen", error),
  });
  return (
    <ToggleControl
      on={screen.enabled}
      pending={screen.pending}
      onToggle={() => void screen.toggle()}
      onLabel="Stop sharing your screen"
      offLabel="Share your screen"
      onIcon={IconScreenShareOff}
      offIcon={IconScreenShare}
      size={size}
      tone="highlight"
    />
  );
}

const DEVICE_KINDS: { kind: MediaDeviceKind; title: string; fallback: string }[] = [
  { kind: "audioinput", title: "Microphone", fallback: "Microphone" },
  { kind: "videoinput", title: "Camera", fallback: "Camera" },
  { kind: "audiooutput", title: "Speaker", fallback: "Speaker" },
];

/** Lists one kind of device; mounted only while the settings menu is open. */
function DeviceSection({ kind, title, fallback }: (typeof DEVICE_KINDS)[number]) {
  // No inline onError here: the hook re-creates its device list whenever that function changes.
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind });
  if (kind === "audiooutput" && (!supportsAudioOutputSelection() || devices.length === 0)) return null;

  return (
    <>
      <Menu.Label>{title}</Menu.Label>
      {devices.length === 0 && <Menu.Item disabled>No {title.toLowerCase()} found</Menu.Item>}
      {devices.map((device, index) => {
        // Before the first permission grant the browser hides names (and ids).
        const active = device.deviceId === activeDeviceId || (!activeDeviceId && device.deviceId === "default");
        return (
          <Menu.Item
            key={`${device.deviceId}-${index}`}
            onClick={() => void setActiveMediaDevice(device.deviceId)}
            rightSection={active ? <IconCheck size={14} aria-label="(selected)" /> : null}
            styles={{ itemLabel: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }}
          >
            {device.label || `${fallback} ${index + 1}`}
          </Menu.Item>
        );
      })}
    </>
  );
}

function DeviceSettings({ size }: { size: number }) {
  const [opened, setOpened] = useState(false);
  return (
    <Menu opened={opened} onChange={setOpened} position="top" shadow="md" width={280} withinPortal>
      <Menu.Target>
        <Tooltip label="Audio and video settings" withArrow disabled={opened}>
          <ActionIcon variant="default" size={size} radius="xl" aria-label="Audio and video settings">
            <IconSettings size={size * 0.48} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown mah="min(420px, 70vh)" style={{ overflowY: "auto" }}>
        {DEVICE_KINDS.map(section => (
          <DeviceSection key={section.kind} {...section} />
        ))}
        <Menu.Divider />
        <SoundsToggle />
      </Menu.Dropdown>
    </Menu>
  );
}

/** Joins, leaves, rings and mute ticks: on by default, remembered per browser. */
function SoundsToggle() {
  const [on, setOn] = useState(callSoundsEnabled);
  return (
    <Menu.Item
      closeMenuOnClick={false}
      leftSection={on ? <IconVolume size={16} /> : <IconVolumeOff size={16} />}
      rightSection={<Switch size="xs" checked={on} readOnly tabIndex={-1} aria-hidden="true" />}
      aria-pressed={on}
      onClick={() => {
        setCallSoundsEnabled(!on);
        setOn(!on);
        if (!on) playCallSound("unmute");
      }}
      data-testid="call-sounds"
    >
      Call sounds
    </Menu.Item>
  );
}

export function LeaveButton({ size = 40, onLeave }: { size?: number; onLeave: () => void }) {
  return (
    <Tooltip label="Leave call" withArrow>
      <ActionIcon color="red" variant="filled" size={size} w={size * 1.4} radius="xl" aria-label="Leave call" onClick={onLeave}>
        <IconPhoneOff size={size * 0.48} />
      </ActionIcon>
    </Tooltip>
  );
}

interface CallControlsProps {
  size?: number;
  onLeave: () => void;
  /** Off on phones: sharing is a desktop thing (and most mobile browsers can't). */
  screenShare?: boolean;
  gap?: MantineSize;
}

/** Mic, camera, screen share (where the browser can), device settings and leave. */
export function CallControls({ size = 40, onLeave, screenShare = true, gap = "xs" }: CallControlsProps) {
  return (
    <Group gap={gap} justify="center" wrap="nowrap" role="toolbar" aria-label="Call controls">
      <MicToggle size={size} />
      <CameraToggle size={size} />
      {screenShare && canShareScreen && <ScreenShareToggle size={size} />}
      <DeviceSettings size={size} />
      <LeaveButton size={size} onLeave={onLeave} />
    </Group>
  );
}
