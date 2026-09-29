import { describe, expect, it } from "vitest";
import { accuracyColor, fillTrend, weekStartUTC } from "./progressUtils.ts";

describe("accuracyColor", () => {
  it("uses red, yellow and green bands", () => {
    expect(accuracyColor(0)).toBe("red");
    expect(accuracyColor(49)).toBe("red");
    expect(accuracyColor(50)).toBe("yellow");
    expect(accuracyColor(69)).toBe("yellow");
    expect(accuracyColor(70)).toBe("green");
    expect(accuracyColor(100)).toBe("green");
  });
});

describe("weekStartUTC", () => {
  it("returns the Monday of the week", () => {
    expect(weekStartUTC(new Date("2026-09-30T15:00:00Z")).toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(weekStartUTC(new Date("2026-10-04T23:59:00Z")).toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(weekStartUTC(new Date("2026-09-28T00:00:00Z")).toISOString()).toBe("2026-09-28T00:00:00.000Z");
  });
});

describe("fillTrend", () => {
  it("fills 8 weeks oldest first, with gaps where nothing was answered", () => {
    const points = fillTrend(
      [
        { weekStart: "2026-09-14T00:00:00.000Z", answered: 10, accuracy: 60 },
        { weekStart: "2026-09-28T00:00:00.000Z", answered: 8, accuracy: 75 },
      ],
      new Date("2026-09-30T12:00:00Z"),
    );
    expect(points).toHaveLength(8);
    expect(points[7]).toMatchObject({ weekStart: "2026-09-28T00:00:00.000Z", accuracy: 75, answered: 8 });
    expect(points[6].accuracy).toBeNull();
    expect(points[5]).toMatchObject({ weekStart: "2026-09-14T00:00:00.000Z", accuracy: 60 });
    expect(points[0].weekStart).toBe("2026-08-10T00:00:00.000Z");
  });
});
