import { useCallback } from "react";
import { isTrackReference, useSpeakingParticipants, useTracks, type TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";
import { useAuth } from "../../auth/AuthContext.tsx";
import { sortTiles, avatarFromMetadata, type TileSummary } from "./callUtils.ts";
import { useCallStatus } from "./useCallStatus.ts";

export interface Tile extends TileSummary {
  trackRef: TrackReferenceOrPlaceholder;
}

export interface Profile {
  name: string;
  avatarUrl: string | null;
}

const SOURCES = [
  { source: Track.Source.Camera, withPlaceholder: true },
  { source: Track.Source.ScreenShare, withPlaceholder: false },
];

/** One tile per person (camera, or their avatar when it's off) plus one per screen share, best first. */
export function useCallTiles(): Tile[] {
  const trackRefs = useTracks(SOURCES);
  // Re-sort as people start and stop talking.
  useSpeakingParticipants();

  return sortTiles(
    trackRefs.map(trackRef => {
      const { participant, source } = trackRef;
      return {
        id: `${participant.identity}:${source}`,
        trackRef,
        screenShare: source === Track.Source.ScreenShare,
        speaking: participant.isSpeaking,
        cameraOn: source === Track.Source.Camera && isTrackReference(trackRef) && !trackRef.publication.isMuted,
        local: participant.isLocal,
        lastSpokeAt: participant.lastSpokeAt?.getTime() ?? 0,
        joinedAt: participant.joinedAt?.getTime() ?? 0,
      };
    }),
  );
}

/**
 * Name and photo for a call participant: yours from your profile; others from
 * LiveKit (name, `{ avatarUrl }` metadata), falling back to the server's call list.
 */
export function useProfileOf(roomId: string): (participant: Participant) => Profile {
  const { user } = useAuth();
  const listed = useCallStatus(roomId).data?.participants;

  return useCallback(
    (participant: Participant) => {
      if (participant.isLocal && user) return { name: user.name, avatarUrl: user.avatarUrl };
      const person = listed?.find(p => p.userId === participant.identity);
      return {
        name: participant.name || person?.name || "Guest",
        avatarUrl: avatarFromMetadata(participant.metadata) ?? person?.avatarUrl ?? null,
      };
    },
    [user, listed],
  );
}
