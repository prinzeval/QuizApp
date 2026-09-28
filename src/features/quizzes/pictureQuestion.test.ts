import { describe, expect, it } from "vitest";
import { isPictureAnswerComplete, parsePlacement, parsePoint } from "./PictureQuestion.tsx";
import { correctText, keyToOption, responseText } from "./quizUtils.ts";

describe("parsePlacement", () => {
  it("reads one entry per spot, with gaps for empty spots", () => {
    expect(parsePlacement("2,,1", 3)).toEqual([2, null, 1]);
    expect(parsePlacement("", 3)).toEqual([null, null, null]);
    expect(parsePlacement("0", 2)).toEqual([0, null]);
  });
});

describe("parsePoint", () => {
  it("reads a tap, or nothing", () => {
    expect(parsePoint("0.4123,0.6")).toEqual([0.4123, 0.6]);
    expect(parsePoint("left")).toBeNull();
    expect(parsePoint("0.1")).toBeNull();
  });
});

describe("isPictureAnswerComplete", () => {
  it("needs every label placed before a drag-the-labels answer counts", () => {
    expect(isPictureAnswerComplete("label_image", "2,,1", 3)).toBe(false);
    expect(isPictureAnswerComplete("label_image", "2,0,1", 3)).toBe(true);
    expect(isPictureAnswerComplete("label_image", "", 0)).toBe(false);
  });

  it("needs a tap for a find-it answer, and text for the rest", () => {
    expect(isPictureAnswerComplete("locate_image", "", 0)).toBe(false);
    expect(isPictureAnswerComplete("locate_image", "0.5,0.5", 0)).toBe(true);
    expect(isPictureAnswerComplete("fill_blank", "  ", 0)).toBe(false);
    expect(isPictureAnswerComplete("multiple_choice", "2", 0)).toBe(true);
  });
});

describe("picture answers in words", () => {
  const figure = { labels: [{ text: "Nucleus" }, { text: "Mitochondrion" }] } as never;

  it("points at the picture instead of printing coordinates", () => {
    expect(responseText({ type: "locate_image", options: null }, "0.4,0.5")).toBe("Your tap is shown on the picture");
    expect(correctText({ type: "locate_image", options: null, correctIndex: 1, acceptedAnswers: null, figure }).answer).toBe(
      "Mitochondrion, highlighted on the picture",
    );
  });

  it("has no keyboard shortcuts for picture questions", () => {
    expect(keyToOption("1", "label_image", 4)).toBeNull();
    expect(keyToOption("a", "locate_image", 0)).toBeNull();
  });
});
