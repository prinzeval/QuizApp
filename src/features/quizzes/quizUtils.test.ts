import { describe, expect, it } from "vitest";
import { correctText, keyToOption, percent, responseText, scoreMessage, splitBlank, topicBreakdown, uniqueTopics } from "./quizUtils.ts";

describe("splitBlank", () => {
  it("splits around the blank", () => {
    expect(splitBlank("The ____ pumps blood.")).toEqual({ before: "The ", after: " pumps blood.", hasBlank: true });
  });
  it("handles long blanks and no blank", () => {
    expect(splitBlank("A ________ b").hasBlank).toBe(true);
    expect(splitBlank("No blank here")).toEqual({ before: "No blank here", after: "", hasBlank: false });
  });
});

describe("keyToOption", () => {
  it("maps numbers and letters for multiple choice", () => {
    expect(keyToOption("1", "multiple_choice", 4)).toBe(0);
    expect(keyToOption("d", "multiple_choice", 4)).toBe(3);
    expect(keyToOption("C", "multiple_choice", 4)).toBe(2);
    expect(keyToOption("5", "multiple_choice", 4)).toBeNull();
    expect(keyToOption("e", "multiple_choice", 4)).toBeNull();
  });
  it("maps T/F and 1/2 for true/false", () => {
    expect(keyToOption("t", "true_false", 2)).toBe(0);
    expect(keyToOption("F", "true_false", 2)).toBe(1);
    expect(keyToOption("2", "true_false", 2)).toBe(1);
    expect(keyToOption("a", "true_false", 2)).toBeNull();
  });
  it("ignores fill in the blank", () => {
    expect(keyToOption("1", "fill_blank", 0)).toBeNull();
  });
});

describe("answers", () => {
  const mc = { type: "multiple_choice" as const, options: ["a", "b", "c", "d"], correctIndex: 2, acceptedAnswers: null };
  it("turns responses into text", () => {
    expect(responseText(mc, "1")).toBe("b");
    expect(responseText(mc, null)).toBeNull();
    expect(responseText({ type: "fill_blank", options: null }, "mitosis")).toBe("mitosis");
  });
  it("reads the correct answer", () => {
    expect(correctText(mc)).toEqual({ answer: "c", alsoAccepted: [] });
    expect(correctText({ type: "fill_blank", options: [], correctIndex: -1, acceptedAnswers: ["atrium", "atria"] })).toEqual({ answer: "atrium", alsoAccepted: ["atria"] });
  });
});

describe("scores", () => {
  it("computes percentages safely", () => {
    expect(percent(3, 5)).toBe(60);
    expect(percent(0, 0)).toBe(0);
  });
  it("picks a message by band", () => {
    expect(scoreMessage(100).title).toBe("Perfect score");
    expect(scoreMessage(85).title).toBe("Excellent work");
    expect(scoreMessage(10).title).toBe("Keep going");
  });
  it("breaks down by topic, weakest first", () => {
    const rows = topicBreakdown([
      { topic: "Heart", isCorrect: true },
      { topic: "Heart", isCorrect: true },
      { topic: "Cells", isCorrect: false },
      { topic: "Cells", isCorrect: true },
      { topic: " ", isCorrect: null },
    ]);
    expect(rows.map(r => r.topic)).toEqual(["General", "Cells", "Heart"]);
    expect(rows[1]).toEqual({ topic: "Cells", correct: 1, total: 2 });
  });
  it("lists unique topics in order", () => {
    expect(uniqueTopics([{ topic: "B" }, { topic: "A" }, { topic: "B" }])).toEqual(["B", "A"]);
  });
});
