import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { callApi, type CallStatus, type CallUpdatedEvent } from "../../lib/callApi.ts";
import { useSocket } from "../../realtime/RealtimeProvider.tsx";

/** Kept out of the shared queryKeys so it never matches the room's prefix invalidations. */
export const callStatusKey = (roomId: string) => ["call-status", roomId] as const;

/**
 * Who's in a room's call: one GET, then kept live by the room's `call:updated` socket
 * event (received while the room's channel is joined, i.e. while a room page is open).
 * A failed request just means "no call button": it's never retried or shown as an error.
 */
export function useCallStatus(roomId: string | undefined) {
  const socket = useSocket();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: callStatusKey(roomId ?? ""),
    queryFn: () => callApi.status(roomId ?? ""),
    enabled: Boolean(roomId),
    retry: false,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!socket || !roomId) return;
    const key = callStatusKey(roomId);
    const onUpdated = ({ roomId: updated, participants }: CallUpdatedEvent) => {
      if (updated !== roomId || !Array.isArray(participants)) return;
      // An update means the server can run calls, even if our first GET failed.
      queryClient.setQueryData<CallStatus>(key, current => ({ configured: current?.configured ?? true, participants }));
    };
    // Missed updates while offline: ask again once we're back.
    const onReconnect = () => queryClient.invalidateQueries({ queryKey: key, exact: true });

    socket.on("call:updated", onUpdated);
    socket.io.on("reconnect", onReconnect);
    return () => {
      socket.off("call:updated", onUpdated);
      socket.io.off("reconnect", onReconnect);
    };
  }, [socket, roomId, queryClient]);

  return query;
}
