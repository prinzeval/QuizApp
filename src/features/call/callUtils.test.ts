import { describe, expect, it } from "vitest";
import type { CallParticipant } from "../../lib/callApi.ts";
import {
  avatarFromMetadata,
  callButtonLabel,
  deviceErrorMessage,
  gridColumns,
  inCallLabel,
  namesLabel,
  sortCallParticipants,
  sortTiles,
  splitStage,
  tileRank,
  type TileSummary,
} from "./callUtils.ts";

const tile = (id: string, overrides: Partial<TileSummary> = {}): TileSummary => ({
  id,
  screenShare: false,
  speaking: false,
  cameraOn: false,
  local: false,
  lastSpokeAt: 0,
  joinedAt: 0,
  ...overrides,
});

const person = (userId: string, name: string, joinedAt: string | null): CallParticipant => ({
  userId,
  name,
  avatarUrl: null,
  joinedAt,
  micOn: true,
  camOn: false,
  screenOn: false,
});

describe("labels", () => {
  it("counts people in the call", () => {
    expect(inCallLabel(0)).toBe("");
    expect(inCallLabel(1)).toBe("1 in call");
    expect(inCallLabel(3)).toBe("3 in call");
  });

  it("picks the header button label", () => {
    expect(callButtonLabel(0, false)).toBe("Start call");
    expect(callButtonLabel(2, false)).toBe("Join call");
    expect(callButtonLabel(2, true)).toBe("Open call");
  });

  it("joins names", () => {
    expect(namesLabel([])).toBe("");
    expect(namesLabel(["Ann"])).toBe("Ann");
    expect(namesLabel(["Ann", "Ben"])).toBe("Ann and Ben");
    expect(namesLabel(["Ann", "Ben", "Cy"])).toBe("Ann, Ben and Cy");
    expect(namesLabel(["Ann", "Ben", "Cy", "Di"])).toBe("Ann, Ben and 2 others");
    expect(namesLabel(["Ann", "Ben", "Cy", "Di", "Ed"], 3)).toBe("Ann, Ben, Cy and 2 others");
    expect(namesLabel(["Ann", "Ben", "Cy", "Di"], 3)).toBe("Ann, Ben, Cy and Di");
  });
});

describe("sortCallParticipants", () => {
  it("orders by join time, unknown last, and drops duplicate users", () => {
    const sorted = sortCallParticipants([
      person("c", "Cy", null),
      person("b", "Ben", "2026-01-01T10:05:00Z"),
      person("a", "Ann", "2026-01-01T10:00:00Z"),
      person("b", "Ben (tab 2)", "2026-01-01T10:06:00Z"),
    ]);
    expect(sorted.map(p => p.name)).toEqual(["Ann", "Ben", "Cy"]);
  });
});

describe("tiles", () => {
  it("ranks screen share > speaking > camera > others", () => {
    expect(tileRank(tile("s", { screenShare: true }))).toBe(0);
    expect(tileRank(tile("t", { speaking: true }))).toBe(1);
    expect(tileRank(tile("c", { cameraOn: true }))).toBe(2);
    expect(tileRank(tile("o"))).toBe(3);
  });

  it("never boosts your own tile for talking", () => {
    expect(tileRank(tile("me", { speaking: true, local: true }))).toBe(3);
    expect(tileRank(tile("me", { speaking: true, local: true, cameraOn: true }))).toBe(2);
  });

  it("sorts by rank, then recent speaker, then you last, then join order", () => {
    const sorted = sortTiles([
      tile("me", { local: true, joinedAt: 1 }),
      tile("quiet", { joinedAt: 3 }),
      tile("early", { joinedAt: 2 }),
      tile("cam", { cameraOn: true }),
      tile("talker", { speaking: true }),
      tile("share", { screenShare: true }),
      tile("spoke-recently", { lastSpokeAt: 50, joinedAt: 9 }),
    ]);
    expect(sorted.map(t => t.id)).toEqual(["share", "talker", "cam", "spoke-recently", "early", "quiet", "me"]);
  });

  it("does not mutate its input", () => {
    const input = [tile("b"), tile("a", { screenShare: true })];
    sortTiles(input);
    expect(input.map(t => t.id)).toEqual(["b", "a"]);
  });

  it("gives a screen share the main tile", () => {
    const { main, others } = splitStage([tile("a"), tile("share", { screenShare: true }), tile("b", { cameraOn: true })]);
    expect(main?.id).toBe("share");
    expect(others.map(t => t.id)).toEqual(["b", "a"]);
  });

  it("has no main tile without a screen share", () => {
    const { main, others } = splitStage([tile("a"), tile("b", { speaking: true })]);
    expect(main).toBeNull();
    expect(others.map(t => t.id)).toEqual(["b", "a"]);
  });

  it("chooses grid columns", () => {
    expect(gridColumns(1, false)).toBe(1);
    expect(gridColumns(2, false)).toBe(2);
    expect(gridColumns(4, false)).toBe(2);
    expect(gridColumns(6, false)).toBe(3);
    expect(gridColumns(12, false)).toBe(4);
    expect(gridColumns(2, true)).toBe(1);
    expect(gridColumns(4, true)).toBe(2);
  });
});

describe("avatarFromMetadata", () => {
  it("reads avatarUrl from JSON metadata", () => {
    expect(avatarFromMetadata('{"avatarUrl":"https://x/a.png"}')).toBe("https://x/a.png");
  });

  it("ignores anything else", () => {
    expect(avatarFromMetadata(undefined)).toBeNull();
    expect(avatarFromMetadata("")).toBeNull();
    expect(avatarFromMetadata("not json")).toBeNull();
    expect(avatarFromMetadata('{"avatarUrl":null}')).toBeNull();
    expect(avatarFromMetadata("[1]")).toBeNull();
  });
});

describe("deviceErrorMessage", () => {
  it("explains blocked, missing and busy devices", () => {
    expect(deviceErrorMessage("microphone", "NotAllowedError")).toMatch(/blocked the microphone/);
    expect(deviceErrorMessage("camera", "NotFoundError")).toMatch(/No camera found/);
    expect(deviceErrorMessage("camera", "NotReadableError")).toMatch(/another app/);
    expect(deviceErrorMessage("microphone", undefined)).toMatch(/Couldn't turn on your microphone/);
  });

  it("stays quiet when you cancel the screen picker", () => {
    expect(deviceErrorMessage("screen", "NotAllowedError")).toBeNull();
    expect(deviceErrorMessage("screen", "AbortError")).toBeNull();
    expect(deviceErrorMessage("screen", "TypeError")).toMatch(/share your screen/);
  });
});
