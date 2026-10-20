import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { VisuallyHidden } from "@mantine/core";
import type { Participant, Room, TrackPublication } from "livekit-client";
import { useAuth } from "../../auth/AuthContext.tsx";
import { ApiError } from "../../lib/api.ts";
import { callApi } from "../../lib/callApi.ts";
import { notify } from "../../notify.ts";
import { useSocket } from "../../realtime/RealtimeProvider.tsx";
import { CallContext, type ActiveCall, type CallContextValue, type CallView, type JoinChoices } from "./callContext.ts";
import { setDevice } from "./devices.ts";
import { playCallSound } from "./callSounds.ts";
import { applyCallVolume, createBoostedAudio, isPhoneLike, savedCallVolume } from "./callVolume.ts";

/** The audio context we handed each call's Room (phones only): ours to close when the call ends. */
const callAudio = new WeakMap<Room, AudioContext>();
const releaseCallAudio = (room: Room) => {
  void callAudio.get(room)?.close().catch(() => undefined);
  callAudio.delete(room);
};

// LiveKit (and the call UI) load only when someone joins a call, not with every page.
const loadLiveKit = () => import("livekit-client");
const CallLayer = lazy(() => import("./CallLayer.tsx").then(module => ({ default: module.CallLayer })));

type LiveKit = Awaited<ReturnType<typeof loadLiveKit>>;

/** Meet/Zoom-style quality: simulcast layers, only send what someone watches, only receive what's on screen. */
const roomOptions = ({ VideoPresets }: LiveKit, audioContext: AudioContext | null) => ({
  // Phones: play call audio through Web Audio + a limiter so it can be boosted (quiet loudspeakers).
  webAudioMix: audioContext ? { audioContext } : false,
  adaptiveStream: true,
  dynacast: true,
  publishDefaults: { simulcast: true },
  videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
  audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
});

function disconnectMessage({ DisconnectReason }: LiveKit, reason: number | undefined): string {
  switch (reason) {
    case DisconnectReason.DUPLICATE_IDENTITY:
      return "You joined this call somewhere else, so it ended here.";
    case DisconnectReason.PARTICIPANT_REMOVED:
      return "You were removed from the call.";
    case DisconnectReason.ROOM_DELETED:
      return "The call has ended.";
    case DisconnectReason.SERVER_SHUTDOWN:
      return "The call server restarted. Join again to continue.";
    default:
      return "You were disconnected from the call.";
  }
}

/**
 * Holds the study call above the routes, so it keeps going while you move between
 * the room, its quizzes, materials and studio. Renders the remote audio, the floating
 * dock / mobile bar / full view, and a polite live region for join/leave announcements.
 * Every change to who's in the call (or their mic/cam/screen) is followed by a
 * `call:changed` socket message so the server can tell everyone viewing the room.
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const socket = useSocket();
  const { status } = useAuth();
  const [session, setSession] = useState<{ call: ActiveCall; room: Room } | null>(null);
  const [view, setView] = useState<CallView>("dock");
  const [announcement, setAnnouncement] = useState("");

  // Event handlers outlive renders: read the latest session/socket through refs.
  const sessionRef = useRef(session);
  const socketRef = useRef(socket);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  const emitChanged = useCallback((roomId: string) => {
    socketRef.current?.emit("call:changed", { roomId });
  }, []);

  const clearSession = useCallback(() => {
    sessionRef.current = null;
    setSession(null);
  }, []);

  const leave = useCallback(async ({ quiet = false }: { quiet?: boolean } = {}) => {
    const current = sessionRef.current;
    if (!current) return;
    // Switching straight into another call plays only that call's join sound.
    if (!quiet) playCallSound("leave");
    // Clear first so the Disconnected handler knows this was on purpose.
    clearSession();
    current.room.removeAllListeners();
    await current.room.disconnect().catch(() => undefined);
    releaseCallAudio(current.room);
    emitChanged(current.call.roomId);
    // LiveKit's participant list can lag a moment behind a leave; ask once more.
    window.setTimeout(() => emitChanged(current.call.roomId), 2000);
    setAnnouncement(`You left the call in ${current.call.roomName}.`);
  }, [emitChanged, clearSession]);

  const join = useCallback(
    async (call: ActiveCall, { mic, cam }: JoinChoices) => {
      // Get the token before leaving anything, so a failure keeps your current call.
      const [{ token, url }, livekit] = await Promise.all([callApi.token(call.roomId), loadLiveKit()]);
      await leave({ quiet: true });

      const audioContext = isPhoneLike() ? createBoostedAudio() : null;
      const room = new livekit.Room(roomOptions(livekit, audioContext));
      if (audioContext) callAudio.set(room, audioContext);
      try {
        await room.connect(url, token);
      } catch {
        await room.disconnect().catch(() => undefined);
        releaseCallAudio(room);
        throw new ApiError("Couldn't connect to the call. Check your connection and try again.", 0);
      }

      wireRoom(livekit, room, call);
      sessionRef.current = { call, room };
      setSession({ call, room });
      setView(current => (current === "full" ? "dock" : current));

      // You might hang up while the mic/camera prompts are still open.
      const stillIn = () => sessionRef.current?.room === room;
      if (mic && stillIn()) await setDevice(room, "microphone", true);
      if (cam && stillIn()) await setDevice(room, "camera", true);
      if (!stillIn()) return;
      // Started from a click, so the browser should allow audio; if not, the dock offers a button.
      await room.startAudio().catch(() => undefined);
      applyCallVolume(room, savedCallVolume());
      playCallSound("join");
      emitChanged(call.roomId);
      setAnnouncement(`You joined the call in ${call.roomName}.`);

      function wireRoom(livekit: LiveKit, room: Room, { roomId, roomName }: ActiveCall) {
        const { RoomEvent } = livekit;
        let timer = 0;
        // Coalesce a burst of track events (e.g. camera on = publish + unmute) into one message.
        const changedSoon = () => {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => emitChanged(roomId), 300);
        };
        const isMe = (participant: Participant) => participant.identity === room.localParticipant.identity;
        // Your own mic going on/off gets a small tick, like Meet.
        const muted = (publication: TrackPublication, participant: Participant, on: boolean) => {
          if (!isMe(participant)) return;
          changedSoon();
          if (publication.source === livekit.Track.Source.Microphone) playCallSound(on ? "unmute" : "mute");
        };
        const label = (participant: Participant) => participant.name || "Someone";
        let lostNoticed = false;
        const reconnecting = () => {
          if (lostNoticed) return;
          lostNoticed = true;
          playCallSound("reconnecting");
          notify("Connection lost. Reconnecting to the call…", "info");
        };

        room
          .on(RoomEvent.LocalTrackPublished, changedSoon)
          .on(RoomEvent.LocalTrackUnpublished, changedSoon)
          .on(RoomEvent.TrackMuted, (publication: TrackPublication, participant: Participant) => muted(publication, participant, false))
          .on(RoomEvent.TrackUnmuted, (publication: TrackPublication, participant: Participant) => muted(publication, participant, true))
          // New voices (and anyone already here) get the chosen call volume.
          .on(RoomEvent.TrackSubscribed, () => applyCallVolume(room, savedCallVolume()))
          .on(RoomEvent.ParticipantConnected, participant => {
            playCallSound("peerJoin");
            setAnnouncement(`${label(participant)} joined the call.`);
          })
          .on(RoomEvent.ParticipantDisconnected, participant => {
            playCallSound("peerLeave");
            setAnnouncement(`${label(participant)} left the call.`);
          })
          // Either connection dropping (signal only, or media too) says the same thing,
          // so a "Reconnected" is never heard without the "lost" before it.
          .on(RoomEvent.SignalReconnecting, reconnecting)
          .on(RoomEvent.Reconnecting, reconnecting)
          .on(RoomEvent.Reconnected, () => {
            lostNoticed = false;
            playCallSound("reconnected");
            notify("Reconnected to the call");
            emitChanged(roomId);
          })
          .on(RoomEvent.Disconnected, reason => {
            window.clearTimeout(timer);
            room.removeAllListeners();
            releaseCallAudio(room);
            // Already cleared: we left on purpose (or switched calls).
            if (sessionRef.current?.room !== room) return;
            clearSession();
            emitChanged(roomId);
            playCallSound("disconnect");
            notify(disconnectMessage(livekit, reason), "info");
            setAnnouncement(`You left the call in ${roomName}.`);
          });
      }
    },
    [leave, emitChanged, clearSession],
  );

  // Removed from the room, or it was deleted: you can't stay in its call.
  // (The realtime layer already explains this if you're on that room's pages.)
  const activeRoomId = session?.call.roomId;
  const activeRoomName = session?.call.roomName;
  useEffect(() => {
    if (!socket || !activeRoomId) return;
    const onGone = (payload: { roomId?: string } | undefined) => {
      if (payload?.roomId !== activeRoomId) return;
      // Not your choice: sounds like a dropped call, not a goodbye.
      playCallSound("disconnect");
      void leave({ quiet: true });
      if (!window.location.pathname.startsWith(`/rooms/${activeRoomId}`)) {
        notify(`Your call in "${activeRoomName}" ended: you no longer have access to that room.`, "info");
      }
    };
    socket.on("user:removed-from-room", onGone);
    socket.on("room:deleted", onGone);
    return () => {
      socket.off("user:removed-from-room", onGone);
      socket.off("room:deleted", onGone);
    };
  }, [socket, activeRoomId, activeRoomName, leave]);

  // Logging out (or the session expiring) ends the call.
  useEffect(() => {
    if (status !== "authenticated") void leave();
  }, [status, leave]);

  // Leaving the logged-in shell altogether: hang up.
  useEffect(
    () => () => {
      const current = sessionRef.current;
      sessionRef.current = null;
      current?.room.removeAllListeners();
      void current?.room.disconnect().then(() => releaseCallAudio(current.room));
    },
    [],
  );

  const value = useMemo<CallContextValue>(
    () => ({ active: session?.call ?? null, join, leave, view, setView }),
    [session, join, leave, view],
  );

  return (
    <CallContext.Provider value={value}>
      {children}
      {session && (
        <Suspense fallback={null}>
          <CallLayer room={session.room} call={session.call} />
        </Suspense>
      )}
      <VisuallyHidden role="status" aria-live="polite">
        {announcement}
      </VisuallyHidden>
    </CallContext.Provider>
  );
}
