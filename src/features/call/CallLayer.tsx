import { RoomAudioRenderer, RoomContext } from "@livekit/components-react";
import type { Room } from "livekit-client";
import type { ActiveCall } from "./callContext.ts";
import { CallSurface } from "./CallSurface.tsx";

/** Everything that needs the connected LiveKit room; loaded on first join. */
export function CallLayer({ room, call }: { room: Room; call: ActiveCall }) {
  return (
    <RoomContext.Provider value={room}>
      {/* Plays everyone else's audio, whatever the dock is showing. */}
      <RoomAudioRenderer />
      <CallSurface call={call} />
    </RoomContext.Provider>
  );
}
