import { Box, Center, Group, Text, type BoxProps } from "@mantine/core";
import { isTrackReference, useIsMuted, useIsSpeaking, VideoTrack } from "@livekit/components-react";
import { Track } from "livekit-client";
import { IconMicrophoneOff, IconScreenShare } from "@tabler/icons-react";
import { UserAvatar } from "../../components/UserAvatar.tsx";
import type { Profile, Tile } from "./useCallTiles.ts";

interface ParticipantTileProps extends BoxProps {
  tile: Tile;
  profile: Profile;
  /** Smaller avatar and label, for the dock and filmstrips. */
  compact?: boolean;
}

/**
 * A person's camera (or their avatar when it's off) or a screen share, with their name,
 * a muted-mic badge and a ring while they talk. Dark in both themes, like any video surface.
 */
export function ParticipantTile({ tile, profile, compact = false, ...boxProps }: ParticipantTileProps) {
  const { trackRef, local, screenShare } = tile;
  const { participant } = trackRef;
  const speaking = useIsSpeaking(participant);
  const micMuted = useIsMuted({ participant, source: Track.Source.Microphone });
  const videoMuted = useIsMuted(trackRef);
  const showVideo = isTrackReference(trackRef) && !videoMuted;

  const name = local ? `${profile.name} (you)` : profile.name;
  const label = screenShare
    ? `${local ? "Your" : `${profile.name}'s`} screen`
    : [name, micMuted ? "microphone off" : "microphone on", showVideo ? "camera on" : "camera off", speaking ? "speaking" : ""].filter(Boolean).join(", ");

  return (
    <Box
      role="group"
      aria-label={label}
      pos="relative"
      bg="dark.8"
      {...boxProps}
      style={{
        borderRadius: compact ? "var(--mantine-radius-md)" : "var(--mantine-radius-lg)",
        overflow: "hidden",
        // Inset ring so it never changes the layout or gets clipped.
        boxShadow: speaking && !screenShare ? "inset 0 0 0 3px var(--mantine-color-teal-5)" : "inset 0 0 0 1px rgba(255,255,255,0.06)",
        transition: "box-shadow 150ms ease",
        minWidth: 0,
        minHeight: 0,
      }}
    >
      {showVideo && isTrackReference(trackRef) ? (
        <VideoTrack
          trackRef={trackRef}
          aria-hidden="true"
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: screenShare ? "contain" : "cover",
            // Your own camera mirrored, like a mirror; screens never are.
            transform: local && !screenShare ? "scaleX(-1)" : undefined,
          }}
        />
      ) : (
        <Center h="100%">
          <UserAvatar name={profile.name} url={profile.avatarUrl} size={compact ? 40 : 72} />
        </Center>
      )}

      <Group
        gap={4}
        wrap="nowrap"
        pos="absolute"
        left={compact ? 4 : 8}
        bottom={compact ? 4 : 8}
        maw={`calc(100% - ${compact ? 8 : 16}px)`}
        px={compact ? 6 : 8}
        py={2}
        aria-hidden="true"
        style={{ background: "rgba(23,23,22,0.66)", borderRadius: "var(--mantine-radius-sm)", color: "#fff" }}
      >
        {screenShare && <IconScreenShare size={compact ? 12 : 14} style={{ flexShrink: 0 }} />}
        {!screenShare && micMuted && <IconMicrophoneOff size={compact ? 12 : 14} color="var(--mantine-color-red-4)" style={{ flexShrink: 0 }} />}
        <Text size={compact ? "xs" : "sm"} fw={500} truncate c="inherit">
          {screenShare ? `${local ? "You" : profile.name} · screen` : name}
        </Text>
      </Group>
    </Box>
  );
}
