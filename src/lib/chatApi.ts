import { request, type Room } from "./api.ts";

const messagesPath = (roomId: string) => `/app/rooms/${encodeURIComponent(roomId)}/messages`;
const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

/** Longest message the server accepts (after trimming). */
export const MESSAGE_MAX = 4000;
/** You can edit your own message for this long after sending it. */
export const EDIT_WINDOW_MS = 15 * 60_000;

export interface ChatMessage {
  id: string;
  roomId: string;
  /** Null once the author's account is gone. */
  userId: string | null;
  userName: string;
  avatarUrl: string | null;
  /** Plain text (never rendered as HTML or markdown). Empty when deleted. */
  body: string;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  /** The message this one answers; `body` is its first 140 characters. */
  replyTo: { id: string; userName: string; body: string } | null;
}

/** One page of history, oldest → newest. */
export interface ChatPage {
  messages: ChatMessage[];
  hasMore: boolean;
  lastReadAt: string | null;
}

/** Rooms now carry how many messages I haven't read (not counting my own). */
export type RoomWithUnread = Room & { unreadCount?: number };

export function unreadOf(room: Room | undefined | null): number {
  return Math.max(0, (room as RoomWithUnread | undefined | null)?.unreadCount ?? 0);
}

export const chatApi = {
  messages: (roomId: string, before?: string, limit = 50) => {
    const query = new URLSearchParams({ limit: String(limit) });
    if (before) query.set("before", before);
    return request<ChatPage>(`${messagesPath(roomId)}?${query}`);
  },
  send: (roomId: string, input: { body: string; replyToId?: string }) =>
    request<{ message: ChatMessage }>(messagesPath(roomId), json("POST", input)),
  edit: (roomId: string, messageId: string, body: string) =>
    request<{ message: ChatMessage }>(`${messagesPath(roomId)}/${encodeURIComponent(messageId)}`, json("PUT", { body })),
  remove: (roomId: string, messageId: string) =>
    request<{ message?: ChatMessage }>(`${messagesPath(roomId)}/${encodeURIComponent(messageId)}`, json("DELETE")),
  markRead: (roomId: string) => request<{ lastReadAt: string }>(`${messagesPath(roomId)}/read`, json("PUT")),
};
