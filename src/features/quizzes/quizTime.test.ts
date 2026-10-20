import { describe, expect, it } from "vitest";
import { QuestionClock, countdownLabel, formatCountdown, formatDuration, remainingMs, timeLimitLabel, totalTimeMs } from "./quizTime.ts";

describe("formatCountdown", () => {
  it("shows mm:ss, rounding up", () => {
    expect(formatCountdown(20 * 60_000)).toBe("20:00");
    expect(formatCountdown(65_000)).toBe("01:05");
    expect(formatCountdown(59_001)).toBe("01:00");
    expect(formatCountdown(500)).toBe("00:01");
  });
  it("never goes negative", () => {
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-5000)).toBe("00:00");
  });
  it("adds hours for long exams", () => {
    expect(formatCountdown(180 * 60_000)).toBe("3:00:00");
    expect(formatCountdown(61 * 60_000 + 5000)).toBe("1:01:05");
  });
});

describe("countdownLabel", () => {
  it("reads naturally", () => {
    expect(countdownLabel(60_000)).toBe("1 minute left");
    expect(countdownLabel(125_000)).toBe("2 minutes 5 seconds left");
    expect(countdownLabel(0)).toBe("0 seconds left");
    expect(countdownLabel(3_600_000)).toBe("1 hour left");
  });
});

describe("remainingMs", () => {
  it("counts down to the deadline", () => {
    const now = Date.parse("2026-10-20T10:00:00Z");
    expect(remainingMs("2026-10-20T10:20:00Z", now)).toBe(20 * 60_000);
    expect(remainingMs("2026-10-20T09:59:00Z", now)).toBe(-60_000);
  });
});

describe("formatDuration", () => {
  it("is short and readable", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45_400)).toBe("45s");
    expect(formatDuration(65_000)).toBe("1m 05s");
    expect(formatDuration(3_725_000)).toBe("1h 02m");
  });
});

describe("timeLimitLabel", () => {
  it("names the limit", () => {
    expect(timeLimitLabel(20)).toBe("20 min exam");
    expect(timeLimitLabel(120)).toBe("2 h exam");
    expect(timeLimitLabel(90)).toBe("1 h 30 min exam");
  });
});

describe("totalTimeMs", () => {
  it("adds recorded times and ignores missing ones", () => {
    expect(totalTimeMs([{ timeSpentMs: 1000 }, { timeSpentMs: null }, { timeSpentMs: 2500 }])).toBe(3500);
  });
  it("is null when nothing was recorded", () => {
    expect(totalTimeMs([{ timeSpentMs: null }, {}])).toBeNull();
    expect(totalTimeMs([])).toBeNull();
  });
});

describe("QuestionClock", () => {
  it("adds up time across visits", () => {
    const clock = new QuestionClock();
    clock.show("a", 0);
    clock.show("b", 10_000);
    expect(clock.elapsed("a", 12_000)).toBe(10_000);
    expect(clock.elapsed("b", 12_000)).toBe(2_000);
    clock.show("a", 15_000);
    expect(clock.elapsed("a", 20_000)).toBe(15_000);
    expect(clock.elapsed("b", 20_000)).toBe(5_000);
  });
  it("pauses while hidden", () => {
    const clock = new QuestionClock();
    clock.show("a", 0);
    clock.show(null, 5_000);
    expect(clock.elapsed("a", 60_000)).toBe(5_000);
    clock.show("a", 60_000);
    expect(clock.elapsed("a", 61_000)).toBe(6_000);
  });
  it("resumes from a saved snapshot and caps at an hour", () => {
    const clock = new QuestionClock({ a: 3_599_000 });
    clock.show("a", 0);
    expect(clock.elapsed("a", 500)).toBe(3_599_500);
    expect(clock.elapsed("a", 10_000)).toBe(3_600_000);
    expect(new QuestionClock({ x: 7 }).snapshot(0)).toEqual({ x: 7 });
  });
});
