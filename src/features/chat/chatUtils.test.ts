import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../../lib/chatApi.ts";
import {
  canDelete,
  canEdit,
  dayLabel,
  firstUnreadId,
  flattenPages,
  formatUnread,
  groupMessages,
  latestFromOthers,
  linkify,
  pendingToShow,
  showCounter,
  typingText,
  upsertMessage,
  type Outgoing,
} from "./chatUtils.ts";

const msg = (id: string, at: string, over: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  roomId: "r1",
  userId: "u1",
  userName: "Ada Lovelace",
  avatarUrl: null,
  body: `message ${id}`,
  createdAt: at,
  editedAt: null,
  deleted: false,
  replyTo: null,
  ...over,
});

const T = (minutes: number) => new Date(Date.UTC(2026, 9, 20, 10, minutes)).toISOString();

describe("flattenPages", () => {
  it("joins newest-first pages into time order without duplicates", () => {
    const pages = [
      { messages: [msg("c", T(3)), msg("d", T(4))], hasMore: true, lastReadAt: null },
      { messages: [msg("a", T(1)), msg("b", T(2)), msg("c", T(3))], hasMore: false, lastReadAt: null },
    ];
    expect(flattenPages(pages).map(m => m.id)).toEqual(["a", "b", "c", "d"]);
    expect(flattenPages(undefined)).toEqual([]);
  });
});

describe("upsertMessage", () => {
  const data = {
    pages: [
      { messages: [msg("c", T(3))], hasMore: true, lastReadAt: null },
      { messages: [msg("a", T(1))], hasMore: false, lastReadAt: null },
    ],
    pageParams: [undefined, "c"],
  };
  it("replaces an existing message in whichever page holds it", () => {
    const next = upsertMessage(data, msg("a", T(1), { body: "edited", editedAt: T(5) }));
    expect(next?.pages[1].messages[0].body).toBe("edited");
    expect(next?.pages[0]).toBe(data.pages[0]);
  });
  it("adds a new message to the newest page in order", () => {
    const next = upsertMessage(data, msg("e", T(9)));
    expect(next?.pages[0].messages.map(m => m.id)).toEqual(["c", "e"]);
    expect(data.pages[0].messages).toHaveLength(1);
  });
  it("does nothing without a cache", () => {
    expect(upsertMessage(undefined, msg("x", T(1)))).toBeUndefined();
  });
});

describe("pendingToShow", () => {
  const outgoing = (localId: string, body: string, at: string, status: Outgoing["status"] = "sending"): Outgoing => ({
    localId,
    body,
    replyTo: null,
    createdAt: at,
    status,
  });
  it("hides a sending message once the real one has arrived", () => {
    const real = [msg("m1", T(1), { userId: "me", body: "hi" })];
    expect(pendingToShow(real, [outgoing("l1", "hi", T(1))], "me")).toEqual([]);
  });
  it("matches each real message only once", () => {
    const real = [msg("m1", T(1), { userId: "me", body: "ok" })];
    const shown = pendingToShow(real, [outgoing("l1", "ok", T(1)), outgoing("l2", "ok", T(1))], "me");
    expect(shown.map(o => o.localId)).toEqual(["l2"]);
  });
  it("keeps failed messages and ignores other people's", () => {
    const real = [msg("m1", T(1), { userId: "someone", body: "hi" })];
    expect(pendingToShow(real, [outgoing("l1", "hi", T(1))], "me")).toHaveLength(1);
    expect(pendingToShow([], [outgoing("l2", "x", T(1), "failed")], "me")).toHaveLength(1);
  });
});

describe("groupMessages", () => {
  it("groups runs by the same author and splits by day and pauses", () => {
    const items = [
      msg("a", T(0)),
      msg("b", T(2)),
      msg("c", T(3), { userId: "u2", userName: "Ben" }),
      msg("d", T(30), { userId: "u2", userName: "Ben" }),
      msg("e", new Date(Date.UTC(2026, 9, 21, 12)).toISOString()),
    ];
    const days = groupMessages(items);
    expect(days).toHaveLength(2);
    expect(days[0].groups.map(g => g.items.map(i => i.id))).toEqual([["a", "b"], ["c"], ["d"]]);
    expect(days[1].groups[0].items.map(i => i.id)).toEqual(["e"]);
  });
  it("starts a new run at the unread line", () => {
    const days = groupMessages([msg("a", T(0)), msg("b", T(1))], "b");
    expect(days[0].groups).toHaveLength(2);
  });
});

describe("dayLabel", () => {
  const now = new Date(2026, 9, 20, 15, 0);
  it("says today and yesterday", () => {
    expect(dayLabel(new Date(2026, 9, 20, 8, 0).toISOString(), now)).toBe("Today");
    expect(dayLabel(new Date(2026, 9, 19, 23, 0).toISOString(), now)).toBe("Yesterday");
  });
  it("adds the year only for other years", () => {
    expect(dayLabel(new Date(2025, 0, 3).toISOString(), now)).toMatch(/2025/);
    expect(dayLabel(new Date(2026, 0, 3).toISOString(), now)).not.toMatch(/2026/);
  });
});

describe("permissions", () => {
  const now = Date.parse(T(10));
  it("edits only my own recent messages", () => {
    expect(canEdit(msg("a", T(0), { userId: "me" }), "me", now)).toBe(true);
    expect(canEdit(msg("a", T(0), { userId: "me" }), "me", now + 15 * 60_000)).toBe(false);
    expect(canEdit(msg("a", T(0), { userId: "u2" }), "me", now)).toBe(false);
    expect(canEdit(msg("a", T(0), { userId: "me", deleted: true }), "me", now)).toBe(false);
    expect(canEdit({ ...msg("a", T(0), { userId: "me" }), status: "sending" }, "me", now)).toBe(false);
  });
  it("deletes my own, or any as the room owner", () => {
    expect(canDelete(msg("a", T(0), { userId: "me" }), "me", false)).toBe(true);
    expect(canDelete(msg("a", T(0), { userId: "u2" }), "me", false)).toBe(false);
    expect(canDelete(msg("a", T(0), { userId: "u2" }), "me", true)).toBe(true);
    expect(canDelete(msg("a", T(0), { userId: "u2", deleted: true }), "me", true)).toBe(false);
  });
});

describe("unread helpers", () => {
  const messages = [msg("a", T(0), { userId: "u2" }), msg("b", T(5), { userId: "me" }), msg("c", T(6), { userId: "u2" })];
  it("finds the first unread message from someone else", () => {
    expect(firstUnreadId(messages, T(1), "me")).toBe("c");
    expect(firstUnreadId(messages, null, "me")).toBeNull();
    expect(firstUnreadId(messages, T(7), "me")).toBeNull();
  });
  it("finds the latest message from someone else", () => {
    expect(latestFromOthers(messages, "me")?.id).toBe("c");
    expect(latestFromOthers([messages[1]], "me")).toBeNull();
  });
  it("caps the badge", () => {
    expect(formatUnread(5)).toBe("5");
    expect(formatUnread(120)).toBe("99+");
  });
});

describe("linkify", () => {
  it("links web addresses and leaves punctuation outside", () => {
    expect(linkify("See https://example.com/a?b=1. Thanks")).toEqual([
      { kind: "text", text: "See " },
      { kind: "link", text: "https://example.com/a?b=1", href: "https://example.com/a?b=1" },
      { kind: "text", text: ". Thanks" },
    ]);
  });
  it("adds https to www links and keeps balanced brackets", () => {
    expect(linkify("www.site.org")).toEqual([{ kind: "link", text: "www.site.org", href: "https://www.site.org" }]);
    expect(linkify("(https://en.wikipedia.org/wiki/Foo_(bar))")[1]).toEqual({
      kind: "link",
      text: "https://en.wikipedia.org/wiki/Foo_(bar)",
      href: "https://en.wikipedia.org/wiki/Foo_(bar)",
    });
  });
  it("never links other schemes", () => {
    expect(linkify("javascript:alert(1) <b>hi</b>")).toEqual([{ kind: "text", text: "javascript:alert(1) <b>hi</b>" }]);
  });
});

describe("typingText", () => {
  it("names one or two people by first name", () => {
    expect(typingText([])).toBe("");
    expect(typingText(["Ada Lovelace"])).toBe("Ada is typing…");
    expect(typingText(["Ada", "Ben Okafor"])).toBe("Ada and Ben are typing…");
    expect(typingText(["A", "B", "C"])).toBe("3 people are typing…");
  });
});

describe("showCounter", () => {
  it("appears near the limit", () => {
    expect(showCounter(100, 4000)).toBe(false);
    expect(showCounter(3700, 4000)).toBe(true);
  });
});
