const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "2 days ago", "just now". */
export function timeAgo(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

const ROOM_COLORS = ["indigo", "teal", "amber", "rose", "sky", "violet", "emerald", "orange"] as const;

/** A stable colour per room so each one is easy to spot in the grid. */
export function roomColor(id: string): (typeof ROOM_COLORS)[number] {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ROOM_COLORS[hash % ROOM_COLORS.length];
}

/**
 * Two letters for an avatar: "Human Anatomy" → "HA", "Sarah" → "SA".
 * Course codes keep their letters: "BIO 201 — Anatomy" → "BI", not "B2".
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w));
  const [first = "?", second] = words;
  const startsWithLetter = (word: string) => /^\p{L}/u.test(word);
  const letters = second && startsWithLetter(first) && startsWithLetter(second) ? [...first][0] + [...second][0] : [...first].slice(0, 2).join("");
  return letters.toUpperCase();
}
