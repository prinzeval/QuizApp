import type { CallParticipant } from "../../lib/callApi.ts";

/** "3 in call"; empty when nobody's there. */
export function inCallLabel(count: number): string {
  return count > 0 ? `${count} in call` : "";
}

/** The header button: open the call you're in, join one that's going, or start one. */
export function callButtonLabel(count: number, inThisCall: boolean): "Open call" | "Join call" | "Start call" {
  if (inThisCall) return "Open call";
  return count > 0 ? "Join call" : "Start call";
}

/** "Ann", "Ann and Ben", "Ann, Ben and 2 others". */
export function namesLabel(names: string[], max = 2): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length <= max + 1) return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  const rest = names.length - max;
  return `${names.slice(0, max).join(", ")} and ${rest} other${rest === 1 ? "" : "s"}`;
}

/** Server list → header order: earliest joiner first, then by name. Drops duplicate users (several tabs). */
export function sortCallParticipants(participants: CallParticipant[]): CallParticipant[] {
  const unique = new Map<string, CallParticipant>();
  for (const person of participants) if (!unique.has(person.userId)) unique.set(person.userId, person);
  const time = (iso: string | null) => (iso ? new Date(iso).getTime() || Infinity : Infinity);
  return [...unique.values()].sort((a, b) => time(a.joinedAt) - time(b.joinedAt) || a.name.localeCompare(b.name));
}

/** The bits of a video tile that decide where it goes. */
export interface TileSummary {
  /** Stable key, e.g. `${identity}:camera`. */
  id: string;
  screenShare: boolean;
  speaking: boolean;
  cameraOn: boolean;
  local: boolean;
  /** ms since epoch; 0 if never. */
  lastSpokeAt: number;
  /** ms since epoch. */
  joinedAt: number;
}

/** Lower comes first: screen share > someone talking > camera on > everyone else. */
export function tileRank(tile: TileSummary): number {
  if (tile.screenShare) return 0;
  // Your own tile never jumps to the front just because you're talking.
  if (tile.speaking && !tile.local) return 1;
  if (tile.cameraOn) return 2;
  return 3;
}

/** Order tiles like Meet: by rank, then whoever spoke most recently, then join order. You go last in a tie. */
export function sortTiles<T extends TileSummary>(tiles: T[]): T[] {
  return [...tiles].sort(
    (a, b) =>
      tileRank(a) - tileRank(b) ||
      b.lastSpokeAt - a.lastSpokeAt ||
      Number(a.local) - Number(b.local) ||
      a.joinedAt - b.joinedAt ||
      a.id.localeCompare(b.id),
  );
}

/**
 * The large view: a screen share takes the big tile and everyone else goes in a strip.
 * Without one there's no main tile and all tiles share an even grid.
 */
export function splitStage<T extends TileSummary>(tiles: T[]): { main: T | null; others: T[] } {
  const sorted = sortTiles(tiles);
  const main = sorted.find(tile => tile.screenShare) ?? null;
  return { main, others: main ? sorted.filter(tile => tile !== main) : sorted };
}

/** Columns for an even grid of `count` tiles. */
export function gridColumns(count: number, mobile: boolean): number {
  if (count <= 1) return 1;
  if (mobile) return count <= 3 ? 1 : 2;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}

/** LiveKit participant metadata may carry `{ avatarUrl }` (JSON); anything else is ignored. */
export function avatarFromMetadata(metadata: string | undefined): string | null {
  if (!metadata) return null;
  try {
    const parsed: unknown = JSON.parse(metadata);
    if (parsed && typeof parsed === "object" && "avatarUrl" in parsed && typeof parsed.avatarUrl === "string") return parsed.avatarUrl || null;
  } catch {
    /* not JSON */
  }
  return null;
}

export type CallDevice = "microphone" | "camera" | "screen";

/**
 * A friendly message for a failed getUserMedia / getDisplayMedia, by the error's `name`.
 * Null when there's nothing to say (you closed the screen picker yourself).
 */
export function deviceErrorMessage(device: CallDevice, errorName: string | undefined): string | null {
  if (device === "screen") {
    if (errorName === "NotAllowedError" || errorName === "AbortError") return null;
    return "Couldn't share your screen. Please try again.";
  }
  switch (errorName) {
    case "NotAllowedError":
    case "SecurityError":
      return `Your browser blocked the ${device}. Allow it in the site settings, then try again. You're still in the call.`;
    case "NotFoundError":
    case "OverconstrainedError":
      return `No ${device} found. You're still in the call without it.`;
    case "NotReadableError":
      return `Your ${device} is being used by another app. Close it and try again.`;
    default:
      return `Couldn't turn on your ${device}. You're still in the call without it.`;
  }
}
