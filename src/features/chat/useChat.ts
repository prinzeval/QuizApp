import { useCallback, useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDocumentVisibility } from "@mantine/hooks";
import { queryKeys } from "../../hooks/queryKeys.ts";
import { chatApi, type ChatMessage } from "../../lib/chatApi.ts";
import { useSocket } from "../../realtime/RealtimeProvider.tsx";
import { useRoomChannel } from "../../realtime/useRoomLive.ts";
import { setRoomUnread, showingChat, upsertChatMessage } from "./chatStore.ts";
import type { Outgoing } from "./chatUtils.ts";

/** Room chat history, newest page first; `fetchNextPage` loads older messages. */
export function useChatMessages(roomId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.messages(roomId),
    queryFn: ({ pageParam }) => chatApi.messages(roomId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => (last.hasMore ? last.messages[0]?.id : undefined),
    enabled: !!roomId,
  });
}

/**
 * Live chat for a room while the chat is on screen: stays in the room's channel
 * (also from the call's chat sheet on any page), upserts messages as they arrive,
 * refetches after a reconnect, and tracks who's typing.
 */
export function useChatLive(roomId: string, myId: string | undefined) {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [typers, setTypers] = useState<Record<string, { name: string; until: number }>>({});
  useRoomChannel(roomId);

  useEffect(() => {
    if (!socket || !roomId) return;
    const onMessage = ({ roomId: from, message }: { roomId: string; message: ChatMessage }) => {
      if (from !== roomId) return;
      upsertChatMessage(queryClient, roomId, message);
      // Once their message lands, they've stopped typing it.
      if (message.userId) setTypers(current => (message.userId! in current ? omit(current, message.userId!) : current));
    };
    const onTyping = ({ roomId: from, userId, name }: { roomId: string; userId: string; name: string }) => {
      if (from !== roomId || userId === myId) return;
      setTypers(current => ({ ...current, [userId]: { name, until: Date.now() + TYPING_TTL_MS } }));
    };
    // Anything said while we were offline.
    const onReconnect = () => queryClient.invalidateQueries({ queryKey: queryKeys.messages(roomId), exact: true });
    socket.on("chat:message", onMessage);
    socket.on("chat:typing", onTyping);
    socket.io.on("reconnect", onReconnect);
    return () => {
      socket.off("chat:message", onMessage);
      socket.off("chat:typing", onTyping);
      socket.io.off("reconnect", onReconnect);
    };
  }, [socket, roomId, myId, queryClient]);

  const anyone = Object.keys(typers).length > 0;
  useEffect(() => {
    if (!anyone) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setTypers(current => {
        const kept = Object.fromEntries(Object.entries(current).filter(([, typer]) => typer.until > now));
        return Object.keys(kept).length === Object.keys(current).length ? current : kept;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [anyone]);

  // Tell the room I'm typing, at most every couple of seconds.
  const lastSent = useRef(0);
  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (!socket || now - lastSent.current < TYPING_THROTTLE_MS) return;
    lastSent.current = now;
    socket.emit("chat:typing", { roomId });
  }, [socket, roomId]);
  const stoppedTyping = useCallback(() => {
    lastSent.current = 0;
  }, []);

  return { typing: Object.values(typers).map(typer => typer.name), sendTyping, stoppedTyping };
}

const TYPING_THROTTLE_MS = 2000;
/** Forget a typer this long after their last "typing" ping. */
const TYPING_TTL_MS = 4500;

function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _, ...rest } = record;
  return rest;
}

/**
 * While the chat is on screen and the tab is visible: marks the room read
 * (debounced, again whenever someone else's newest message changes) and
 * zeroes its unread badges.
 */
export function useMarkChatRead(roomId: string, latestOtherId: string | null, ready: boolean) {
  const queryClient = useQueryClient();
  const visible = useDocumentVisibility() === "visible";

  useEffect(() => {
    if (!visible || !roomId) return;
    return showingChat(roomId);
  }, [visible, roomId]);

  useEffect(() => {
    if (!visible || !ready || !roomId) return;
    const timer = setTimeout(() => {
      chatApi
        .markRead(roomId)
        .then(() => {
          setRoomUnread(queryClient, roomId, 0);
          // Settle any room-list refresh that raced the read.
          void queryClient.invalidateQueries({ queryKey: queryKeys.rooms, exact: true });
        })
        .catch(() => {
          /* the badge just stays until the next read */
        });
    }, READ_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [visible, ready, roomId, latestOtherId, queryClient]);
}

const READ_DEBOUNCE_MS = 800;

let localCounter = 0;
const localId = () => `local-${Date.now().toString(36)}-${(localCounter += 1)}`;

/** Sending with an optimistic "Sending…" entry that turns into "Not sent · Retry" on failure. */
export function useSendMessage(roomId: string) {
  const queryClient = useQueryClient();
  const [outgoing, setOutgoing] = useState<Outgoing[]>([]);

  const deliver = useCallback(
    (item: Outgoing) => {
      chatApi.send(roomId, { body: item.body, replyToId: item.replyToId }).then(
        ({ message }) => {
          upsertChatMessage(queryClient, roomId, message);
          setOutgoing(list => list.filter(o => o.localId !== item.localId));
        },
        (error: unknown) =>
          setOutgoing(list =>
            list.map(o =>
              o.localId === item.localId ? { ...o, status: "failed", error: error instanceof Error ? error.message : "Couldn't send." } : o,
            ),
          ),
      );
    },
    [roomId, queryClient],
  );

  const send = useCallback(
    (body: string, replyTo: ChatMessage | null) => {
      const item: Outgoing = {
        localId: localId(),
        body,
        replyTo: replyTo ? { id: replyTo.id, userName: replyTo.userName, body: replyTo.body.slice(0, 140) } : null,
        replyToId: replyTo?.id,
        createdAt: new Date().toISOString(),
        status: "sending",
      };
      setOutgoing(list => [...list, item]);
      deliver(item);
    },
    [deliver],
  );

  const retry = useCallback(
    (id: string) => {
      const item = outgoing.find(o => o.localId === id);
      if (!item) return;
      const again: Outgoing = { ...item, status: "sending", error: undefined, createdAt: new Date().toISOString() };
      setOutgoing(list => list.map(o => (o.localId === id ? again : o)));
      deliver(again);
    },
    [outgoing, deliver],
  );

  const discard = useCallback((id: string) => setOutgoing(list => list.filter(o => o.localId !== id)), []);

  return { outgoing, send, retry, discard };
}

export function useEditMessage(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, body }: { messageId: string; body: string }) => chatApi.edit(roomId, messageId, body),
    onSuccess: ({ message }) => upsertChatMessage(queryClient, roomId, message),
  });
}

export function useDeleteMessage(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: ChatMessage) => chatApi.remove(roomId, message.id),
    onSuccess: (result, message) =>
      upsertChatMessage(queryClient, roomId, result?.message ?? { ...message, deleted: true, body: "", replyTo: message.replyTo }),
  });
}
