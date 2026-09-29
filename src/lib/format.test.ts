import { describe, expect, it } from "vitest";
import { initials, plural, roomColor } from "./format.ts";

describe("initials", () => {
  it.each([
    ["Human Anatomy", "HA"],
    ["BIO 201 — Human Anatomy", "BI"],
    ["CHEM 110 Organic", "CH"],
    ["Valentine Chinaechetam onuoha", "VC"],
    ["sarah", "SA"],
    ["  Élodie   Martin ", "ÉM"],
    ["2024 Finals", "20"],
    ["", "?"],
  ])("%s → %s", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe("plural", () => {
  it("adds an s except for one", () => {
    expect(plural(1, "member")).toBe("1 member");
    expect(plural(3, "member")).toBe("3 members");
  });
});

describe("roomColor", () => {
  it("is stable for the same id", () => {
    expect(roomColor("abc")).toBe(roomColor("abc"));
  });
});
