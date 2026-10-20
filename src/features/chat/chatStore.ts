import { useSyncExternalStore } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../hooks/queryKeys.ts";
import type { ChatMessage } from "../../lib/chatApi.ts";
import type { Room, RoomMember } from "../../lib/api.ts";
import { upsertMessage, type ChatPages } from "./chatUtils.ts";

/* ------------------------------------------------- which chats are on screen */

const visible = new Map<string, number>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

/** Marks a room's chat as being read on screen (the tab, or the call's chat sheet). Returns the undo. */
export function showingChat(roomId: string): () => void {
  visible.set(roomId, (visible.get(roomId) ?? 0) + 1);
  emit();
  return () => {
    const left = (visible.get(roomId) ?? 1) - 1;
    if (left > 0) visible.set(roomId, left);
    else visible.delete(roomId);
    emit();
  };
}

export const isChatShowing = (roomId: string) => visible.has(roomId);

/** Whether someone is reading this room's chat right now (its unread badge can stay hidden). */
export function useChatShowing(roomId: string | null | undefined): boolean {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => (roomId ? visible.has(roomId) : false),
  );
}

/* ------------------------------------------------------------ cache updates */

/** A new, edited or deleted message from the live connection (or my own send): put it in the chat cache. */
export function upsertChatMessage(queryClient: QueryClient, roomId: string, message: ChatMessage): void {
  queryClient.setQueryData<ChatPages>(queryKeys.messages(roomId), current => upsertMessage(current, message));
}

/** Sets a room's unread count in the room list and the room page's cache (e.g. 0 once read). */
export function setRoomUnread(queryClient: QueryClient, roomId: string, unreadCount: number): void {
  queryClient.setQueryData<Room[]>(queryKeys.rooms, current =>
    current?.map(room => (room.id === roomId ? { ...room, unreadCount } : room)),
  );
  queryClient.setQueryData<{ room: Room; members: RoomMember[] }>(queryKeys.room(roomId), current =>
    current ? { ...current, room: { ...current.room, unreadCount } } : current,
  );
}
