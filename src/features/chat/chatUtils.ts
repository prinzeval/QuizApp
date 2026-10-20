import { EDIT_WINDOW_MS, type ChatMessage, type ChatPage } from "../../lib/chatApi.ts";

/** React Query's infinite data, newest page first (each page is oldest → newest). */
export interface ChatPages {
  pages: ChatPage[];
  pageParams: (string | undefined)[];
}

/** A message on screen: from the server, or one of mine still sending / failed to send. */
export type ChatItem = ChatMessage & { status?: "sending" | "failed" };

/** A message I've sent that the server hasn't confirmed yet. */
export interface Outgoing {
  localId: string;
  body: string;
  replyTo: ChatMessage["replyTo"];
  replyToId?: string;
  createdAt: string;
  status: "sending" | "failed";
  error?: string;
}

/** Messages in this run of the same author are shown under one name and avatar. */
const GROUP_GAP_MS = 5 * 60_000;

const byTime = (a: ChatMessage, b: ChatMessage) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/** All loaded messages in time order, each once. */
export function flattenPages(pages: ChatPage[] | undefined): ChatMessage[] {
  if (!pages?.length) return [];
  const seen = new Map<string, ChatMessage>();
  for (let i = pages.length - 1; i >= 0; i--) for (const message of pages[i].messages) seen.set(message.id, message);
  return [...seen.values()].sort(byTime);
}

/** Puts a new, edited or deleted message into the cached pages (by id). Leaves the cache alone if there isn't one. */
export function upsertMessage<T extends ChatPages>(data: T | undefined, message: ChatMessage): T | undefined {
  if (!data || data.pages.length === 0) return data;
  const at = data.pages.findIndex(page => page.messages.some(m => m.id === message.id));
  if (at !== -1) {
    const pages = data.pages.map((page, i) => (i === at ? { ...page, messages: page.messages.map(m => (m.id === message.id ? message : m)) } : page));
    return { ...data, pages };
  }
  const [newest, ...rest] = data.pages;
  return { ...data, pages: [{ ...newest, messages: [...newest.messages, message].sort(byTime) }, ...rest] };
}

/** My unconfirmed messages that aren't already showing as real ones (the live event can beat the POST reply). */
export function pendingToShow(messages: ChatMessage[], outgoing: Outgoing[], myId: string | undefined): Outgoing[] {
  const claimed = new Set<string>();
  return outgoing.filter(item => {
    if (item.status === "failed") return true;
    const sentAt = Date.parse(item.createdAt);
    const match = messages.find(
      m => !claimed.has(m.id) && m.userId === myId && !m.deleted && m.body === item.body && Date.parse(m.createdAt) >= sentAt - 30_000,
    );
    if (!match) return true;
    claimed.add(match.id);
    return false;
  });
}

export function outgoingToItem(item: Outgoing, me: { id: string; name: string; avatarUrl: string | null }, roomId: string): ChatItem {
  return {
    id: item.localId,
    roomId,
    userId: me.id,
    userName: me.name,
    avatarUrl: me.avatarUrl,
    body: item.body,
    createdAt: item.createdAt,
    editedAt: null,
    deleted: false,
    replyTo: item.replyTo,
    status: item.status,
  };
}

export interface MessageGroup {
  key: string;
  userId: string | null;
  userName: string;
  avatarUrl: string | null;
  items: ChatItem[];
}

export interface DaySection {
  key: string;
  date: string;
  groups: MessageGroup[];
}

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
const author = (m: ChatMessage) => m.userId ?? `name:${m.userName}`;

/**
 * Splits messages into days, and each day into runs by the same person
 * (a new run after a 5 minute pause, or before `breakBefore`, e.g. the first unread).
 */
export function groupMessages(items: ChatItem[], breakBefore: string | null = null): DaySection[] {
  const days: DaySection[] = [];
  let lastTime = 0;
  for (const item of items) {
    const key = dayKey(item.createdAt);
    let day = days.at(-1);
    if (!day || day.key !== key) {
      day = { key, date: item.createdAt, groups: [] };
      days.push(day);
    }
    const time = Date.parse(item.createdAt);
    const group = day.groups.at(-1);
    const last = group?.items.at(-1);
    if (group && last && author(last) === author(item) && time - lastTime <= GROUP_GAP_MS && item.id !== breakBefore) {
      group.items.push(item);
    } else {
      day.groups.push({ key: item.id, userId: item.userId, userName: item.userName, avatarUrl: item.avatarUrl, items: [item] });
    }
    lastTime = time;
  }
  return days;
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "Today", "Yesterday", "Monday, 12 October", or with the year when it isn't this year. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: days < 7 && days > 0 ? "long" : "short",
    day: "numeric",
    month: "long",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function canEdit(message: ChatItem, myId: string | undefined, now: number): boolean {
  return !!myId && message.userId === myId && !message.deleted && !message.status && now - Date.parse(message.createdAt) < EDIT_WINDOW_MS;
}

export function canDelete(message: ChatItem, myId: string | undefined, isOwner: boolean): boolean {
  if (message.deleted || message.status) return false;
  return isOwner || (!!myId && message.userId === myId);
}

/** The first message from someone else after I last read the room (where the "New" line goes). */
export function firstUnreadId(messages: ChatMessage[], lastReadAt: string | null, myId: string | undefined): string | null {
  if (!lastReadAt) return null;
  const read = Date.parse(lastReadAt);
  return messages.find(m => m.userId !== myId && Date.parse(m.createdAt) > read)?.id ?? null;
}

/** The newest message from someone else: when it changes, there's something new to mark read. */
export function latestFromOthers(messages: ChatMessage[], myId: string | undefined): ChatMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].userId !== myId) return messages[i];
  return null;
}

export type TextPart = { kind: "text"; text: string } | { kind: "link"; text: string; href: string };

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
const TRAILING = /[.,;:!?'")\]}]$/;
const count = (text: string, char: string) => text.split(char).length - 1;

/** Splits plain text into text and web links (http(s) and www. only; nothing else becomes markup). */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    let url = match[0];
    // Leave closing punctuation outside the link, but keep balanced brackets like wiki/Foo_(bar).
    while (TRAILING.test(url)) {
      const end = url.at(-1);
      if (end === ")" && count(url, "(") >= count(url, ")")) break;
      url = url.slice(0, -1);
    }
    const start = match.index;
    if (start > last) parts.push({ kind: "text", text: text.slice(last, start) });
    parts.push({ kind: "link", text: url, href: url.toLowerCase().startsWith("www.") ? `https://${url}` : url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}

/** "Ada is typing…", "Ada and Ben are typing…", "3 people are typing…". */
export function typingText(names: string[]): string {
  const first = (name: string) => name.trim().split(/\s+/)[0] || "Someone";
  if (names.length === 0) return "";
  if (names.length === 1) return `${first(names[0])} is typing…`;
  if (names.length === 2) return `${first(names[0])} and ${first(names[1])} are typing…`;
  return `${names.length} people are typing…`;
}

/** Badge text: "3", "99+". */
export function formatUnread(count: number): string {
  return count > 99 ? "99+" : String(count);
}

/** Show the length counter once a message gets close to the limit. */
export function showCounter(length: number, max: number): boolean {
  return length >= max - 400;
}
