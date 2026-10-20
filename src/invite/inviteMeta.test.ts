// The real page the function serves, read as text by Vite.
import html from "../../index.html?raw";
import { describe, expect, it } from "vitest";
import { injectMeta, inviteMeta, type InviteForMeta } from "../../api/invite.ts";

const at = { origin: "https://smartquiz.example", path: "/invite/abc" };
const invite: InviteForMeta = { status: "valid", room: { name: "Human anatomy", memberCount: 3 }, invitedBy: { name: "Ada" } };
const tag = (page: string, attr: string, key: string) => page.match(new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`))?.[1];

describe("invite link previews", () => {
  it("say who invited you to which room", () => {
    const page = injectMeta(html, inviteMeta(invite, at));
    expect(page).toContain("<title>Ada invited you to join “Human anatomy” on SmartQuiz</title>");
    expect(tag(page, "property", "og:title")).toBe("Ada invited you to join “Human anatomy” on SmartQuiz");
    expect(tag(page, "name", "twitter:title")).toBe("Ada invited you to join “Human anatomy” on SmartQuiz");
    expect(tag(page, "property", "og:description")).toMatch(/3 members/);
    expect(tag(page, "property", "og:url")).toBe("https://smartquiz.example/invite/abc");
    expect(tag(page, "property", "og:image")).toBe("https://smartquiz.example/og-invite.png");
    expect(tag(page, "name", "robots")).toBe("noindex, nofollow");
    // Still the same app: the scripts are untouched.
    expect(page).toContain('<div id="root"></div>');
  });

  it("are honest about dead links", () => {
    for (const dead of [null, { ...invite, status: "expired" as const }, { ...invite, status: "revoked" as const }]) {
      const page = injectMeta(html, inviteMeta(dead, at));
      expect(tag(page, "property", "og:title")).toBe("This SmartQuiz invite has expired");
      expect(tag(page, "property", "og:image")).toBe("https://smartquiz.example/og-image.png");
    }
  });

  it("can't be broken by a room or person's name", () => {
    const sneaky = { ...invite, room: { name: '"><script>alert(1)</script>', memberCount: 1 }, invitedBy: { name: "<b>Eve</b>" } };
    const page = injectMeta(html, inviteMeta(sneaky, at));
    expect(page).not.toContain("<script>alert(1)</script>");
    expect(page).not.toContain("<b>Eve</b>");
    expect(tag(page, "property", "og:description")).toMatch(/1 member\)/);
  });

  it("shorten very long names", () => {
    const meta = inviteMeta({ ...invite, room: { name: "x".repeat(200), memberCount: 2 } }, at);
    expect(meta.title.length).toBeLessThan(120);
  });
});
