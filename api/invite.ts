/**
 * GET /invite/:token (via the rewrite in vercel.json): the app's index.html
 * with link-preview tags that describe the invite, so WhatsApp, iMessage, Slack,
 * LinkedIn and X show "Ada invited you to join Human anatomy" instead of the
 * generic SmartQuiz card. People get the same app page; it loads as usual.
 * Self-contained on purpose (no imports), so Vercel bundles it as is.
 */

// Same variable the app is built with (Vercel exposes project env vars to functions too).
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const API_URL = env.VITE_API_URL || "https://quizapp-be-production.up.railway.app/api/v1";
const LOOKUP_TIMEOUT_MS = 2500;

export interface InviteForMeta {
  status: "valid" | "expired" | "revoked" | "used_up";
  room: { name: string; memberCount: number };
  invitedBy: { name: string } | null;
}

export interface PageMeta {
  title: string;
  description: string;
  url: string;
  image: string;
  imageAlt: string;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
/** Short enough for preview cards, which cut long titles anyway. */
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** What an invite link's preview says. `invite` is null when the link is unknown. */
export function inviteMeta(invite: InviteForMeta | null, { origin, path }: { origin: string; path: string }): PageMeta {
  const url = `${origin}${path}`;
  const image = `${origin}/og-invite.png`;

  if (!invite || invite.status !== "valid") {
    return {
      title: "This SmartQuiz invite has expired",
      description: "Ask whoever sent it for a new invite link to join their study room on SmartQuiz.",
      url,
      image: `${origin}/og-image.png`,
      imageAlt: "SmartQuiz",
    };
  }

  const room = clip(invite.room.name, 60);
  const inviter = invite.invitedBy ? clip(invite.invitedBy.name, 40) : null;
  return {
    title: inviter ? `${inviter} invited you to join “${room}” on SmartQuiz` : `You're invited to join “${room}” on SmartQuiz`,
    description: `Study together in “${room}” (${plural(invite.room.memberCount, "member")}): shared quizzes from your notes, an AI tutor that cites the page, flashcards and live study calls. Tap to join.`,
    url,
    image,
    imageAlt: `Invitation to join ${room} on SmartQuiz`,
  };
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * Swaps the page's title and every preview tag (Open Graph, Twitter, canonical)
 * for these. Tags missing from the page are left alone.
 */
export function injectMeta(html: string, meta: PageMeta): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const set = (source: string, attr: "name" | "property", key: string, value: string) =>
    source.replace(new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`), `$1${value}$2`);

  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  out = set(out, "name", "description", description);
  out = set(out, "property", "og:title", title);
  out = set(out, "property", "og:description", description);
  out = set(out, "property", "og:url", escapeHtml(meta.url));
  out = set(out, "property", "og:image", escapeHtml(meta.image));
  out = set(out, "property", "og:image:alt", escapeHtml(meta.imageAlt));
  out = set(out, "name", "twitter:title", title);
  out = set(out, "name", "twitter:description", description);
  out = set(out, "name", "twitter:image", escapeHtml(meta.image));
  out = out.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/, `$1${escapeHtml(meta.url)}$2`);
  // Invite pages are private: link previews yes, search results no.
  out = out.replace(/(<meta\s+name="robots"\s+content=")[^"]*(")/, "$1noindex, nofollow$2");
  return out;
}

async function loadInvite(token: string): Promise<InviteForMeta | null> {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(token)) return null;
  try {
    const response = await fetch(`${API_URL}/auth/invites/${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: { invite?: InviteForMeta } };
    return body.data?.invite ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? url.pathname.split("/").pop() ?? "";
  const origin = `${url.protocol}//${url.host}`;
  const [page, invite] = await Promise.all([fetch(`${origin}/index.html`).then(response => response.text()), loadInvite(token)]);
  const html = injectMeta(page, inviteMeta(invite, { origin, path: `/invite/${encodeURIComponent(token)}` }));
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Crawlers fetch each link once; a short shared cache keeps repeat shares fast.
      "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
