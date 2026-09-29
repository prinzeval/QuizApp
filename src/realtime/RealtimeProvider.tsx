import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { API_ORIGIN, tokenStore } from "../lib/api.ts";
import { useAuth } from "../auth/AuthContext.tsx";
import { queryKeys } from "../hooks/queryKeys.ts";
import { notify } from "../notify.ts";

const RealtimeContext = createContext<Socket | null>(null);

/**
 * One Socket.IO connection per logged-in session. The token is read on every
 * (re)connect, so a password change (new token) is picked up automatically.
 * Personal events (removed from a room, room list changed) are handled here;
 * room events are handled by useRoomLive.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    const connection = io(API_ORIGIN, {
      auth: callback => callback({ token: tokenStore.get() }),
      transports: ["websocket", "polling"],
    });

    connection.on("user:rooms-changed", () => queryClient.invalidateQueries({ queryKey: queryKeys.rooms, exact: true }));
    connection.on("user:removed-from-room", ({ roomId }: { roomId: string }) => {
      queryClient.removeQueries({ queryKey: queryKeys.room(roomId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms, exact: true });
      if (window.location.pathname.startsWith(`/rooms/${roomId}`)) {
        navigate("/", { replace: true });
        notify("You were removed from that room.", "info");
      }
    });

    setSocket(connection);
    return () => {
      connection.removeAllListeners();
      connection.disconnect();
      setSocket(null);
    };
  }, [status, queryClient, navigate]);

  return <RealtimeContext.Provider value={socket}>{children}</RealtimeContext.Provider>;
}

export function useSocket(): Socket | null {
  return useContext(RealtimeContext);
}
