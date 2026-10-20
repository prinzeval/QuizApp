import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { Socket } from "socket.io-client";
import type { Material, PresenceUser } from "../lib/learningApi.ts";
import type { ChatMessage } from "../lib/chatApi.ts";
import { queryKeys } from "../hooks/queryKeys.ts";
import { notify } from "../notify.ts";
import { upsertChatMessage } from "../features/chat/chatStore.ts";
import { useSocket } from "./RealtimeProvider.tsx";

/**
 * How many parts of the page want each room's live channel. Several can at once
 * (the room page, and the call's chat sheet), so the room is left only when the last one goes.
 */
const channelUsers = new WeakMap<Socket, Map<string, number>>();

function acquireChannel(socket: Socket, roomId: string): () => void {
  const counts = channelUsers.get(socket) ?? new Map<string, number>();
  channelUsers.set(socket, counts);
  const join = () => socket.emit("room:join", { roomId });
  counts.set(roomId, (counts.get(roomId) ?? 0) + 1);
  // Joining twice is harmless, and every user rejoins after a reconnect.
  socket.on("connect", join);
  if (socket.connected) join();
  return () => {
    socket.off("connect", join);
    const left = (counts.get(roomId) ?? 1) - 1;
    if (left > 0) counts.set(roomId, left);
    else {
      counts.delete(roomId);
      socket.emit("room:leave", { roomId });
    }
  };
}

/** Keeps the socket in a room's channel while mounted, without the room page's other live updates. */
export function useRoomChannel(roomId: string | null | undefined): void {
  const socket = useSocket();
  useEffect(() => {
    if (!socket || !roomId) return;
    return acquireChannel(socket, roomId);
  }, [socket, roomId]);
}

/**
 * Subscribes to a room while its page is open: joins the room's channel (again
 * after any reconnect), tracks who else is viewing, and refreshes the right
 * cached data when something changes. Returns the people currently viewing.
 */
export function useRoomLive(roomId: string): PresenceUser[] {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [present, setPresent] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!socket || !roomId) return;

    const mine = <T extends { roomId?: string }>(handler: (payload: T) => void) => (payload: T) => payload.roomId === roomId && handler(payload);

    const onPresence = mine(({ users }: { roomId: string; users: PresenceUser[] }) => setPresent(users));
    const onRoom = mine(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId), exact: true });
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms, exact: true });
    });
    const onRoomDeleted = mine(() => {
      queryClient.removeQueries({ queryKey: queryKeys.room(roomId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms, exact: true });
      navigate("/", { replace: true });
      notify("This room was deleted by its owner.", "info");
    });
    const onMaterial = mine(({ material }: { roomId: string; material: Material }) => {
      // Patch the list in place for instant status updates, then refetch to be safe.
      queryClient.setQueryData<{ materials: Material[] }>(queryKeys.materials(roomId), current => {
        if (!current) return current;
        const exists = current.materials.some(m => m.id === material.id);
        return { materials: exists ? current.materials.map(m => (m.id === material.id ? material : m)) : [material, ...current.materials] };
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.material(roomId, material.id) });
    });
    const onMaterialDeleted = mine(({ materialId }: { roomId: string; materialId: string }) => {
      queryClient.setQueryData<{ materials: Material[] }>(queryKeys.materials(roomId), current =>
        current ? { materials: current.materials.filter(m => m.id !== materialId) } : current,
      );
    });
    const onQuiz = mine(({ quizId }: { roomId: string; quizId: string }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quizzes(roomId), exact: true });
      queryClient.invalidateQueries({ queryKey: queryKeys.quiz(roomId, quizId), exact: true });
    });

    // Someone started, answered, finished or changed sharing on a quiz: refresh its "Studying together" board.
    const onQuizBoard = mine(({ quizId }: { roomId: string; quizId: string }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quizBoard(roomId, quizId), exact: true });
      // The quiz list shows who's taking each quiz right now.
      queryClient.invalidateQueries({ queryKey: queryKeys.quizzes(roomId), exact: true });
    });

    const onStudio = mine(({ itemId }: { roomId: string; itemId: string }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.studio(roomId), exact: true });
      queryClient.invalidateQueries({ queryKey: queryKeys.studioItem(roomId, itemId), exact: true });
    });

    // New, edited or deleted chat messages: keep a loaded chat current even while its tab is closed.
    const onChatMessage = mine(({ message }: { roomId: string; message: ChatMessage }) => upsertChatMessage(queryClient, roomId, message));

    const release = acquireChannel(socket, roomId);
    socket.on("room:presence", onPresence);
    socket.on("chat:message", onChatMessage);
    socket.on("room:updated", onRoom);
    socket.on("member:joined", onRoom);
    socket.on("member:left", onRoom);
    socket.on("room:deleted", onRoomDeleted);
    socket.on("material:updated", onMaterial);
    socket.on("material:deleted", onMaterialDeleted);
    socket.on("quiz:updated", onQuiz);
    socket.on("quiz:deleted", onQuiz);
    socket.on("quiz:board", onQuizBoard);
    socket.on("studio:updated", onStudio);
    socket.on("studio:deleted", onStudio);

    return () => {
      release();
      socket.off("room:presence", onPresence);
      socket.off("chat:message", onChatMessage);
      socket.off("room:updated", onRoom);
      socket.off("member:joined", onRoom);
      socket.off("member:left", onRoom);
      socket.off("room:deleted", onRoomDeleted);
      socket.off("material:updated", onMaterial);
      socket.off("material:deleted", onMaterialDeleted);
      socket.off("quiz:updated", onQuiz);
      socket.off("quiz:deleted", onQuiz);
      socket.off("quiz:board", onQuizBoard);
      socket.off("studio:updated", onStudio);
      socket.off("studio:deleted", onStudio);
      setPresent([]);
    };
  }, [socket, roomId, queryClient, navigate]);

  return present;
}
