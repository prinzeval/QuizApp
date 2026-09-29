import { describe, expect, it } from "vitest";
import type { MaterialChunk } from "../../../lib/learningApi.ts";
import { aiReadBadge, aiReadSummary, plainExcerpt, countMatches, groupPassages, joinWithoutOverlap, locationNumber, pdfPageOf, readingProgress, searchSections } from "./passages.ts";

const chunk = (chunkIndex: number, location: string | null, content: string): MaterialChunk => ({ id: `c${chunkIndex}`, chunkIndex, location, content });

/** The backend's overlap: the previous passage's last ~200 chars from a word boundary, a blank line, then new text. */
const overlapped = (previous: string, next: string) => {
  const tail = previous.slice(-200);
  return `${tail.slice(tail.search(/\s/) + 1)}\n\n${next}`;
};

describe("locationNumber / pdfPageOf", () => {
  it("reads page and slide numbers", () => {
    expect(locationNumber("Page 7")).toBe(7);
    expect(locationNumber("slide 12")).toBe(12);
    expect(locationNumber("Figure 2 on page 3")).toBeNull();
    expect(locationNumber(null)).toBeNull();
  });

  it("only points at a PDF page for PDFs", () => {
    expect(pdfPageOf("pdf", "Page 3")).toBe(3);
    expect(pdfPageOf("pptx", "Slide 3")).toBeNull();
    expect(pdfPageOf("pdf", null)).toBeNull();
    expect(pdfPageOf(undefined, "Page 3")).toBeNull();
  });
});

describe("joinWithoutOverlap", () => {
  const first = "The heart has four chambers. ".repeat(12) + "Blood leaves the left ventricle through the aorta.";

  it("drops the repeated tail of the previous passage", () => {
    const next = overlapped(first, "The right ventricle pumps blood to the lungs.");
    expect(joinWithoutOverlap(first, next)).toBe(`${first}\n\nThe right ventricle pumps blood to the lungs.`);
  });

  it("keeps both when they don't overlap", () => {
    expect(joinWithoutOverlap("Alpha beta gamma.", "Delta epsilon.")).toBe("Alpha beta gamma.\n\nDelta epsilon.");
  });

  it("doesn't treat a short coincidental repeat as overlap", () => {
    expect(joinWithoutOverlap("It ends with the aorta.", "aorta.\n\nNext part")).toBe("It ends with the aorta.\n\naorta.\n\nNext part");
  });
});

describe("groupPassages", () => {
  it("merges consecutive passages from the same page, in order", () => {
    const long = "Systole is contraction. ".repeat(20).trim();
    const sections = groupPassages([
      chunk(2, "Page 2", "Page two text."),
      chunk(0, "Page 1", long),
      chunk(1, "Page 1", overlapped(long, "Diastole is relaxation.")),
    ]);
    expect(sections.map(s => [s.location, s.number])).toEqual([
      ["Page 1", 1],
      ["Page 2", 2],
    ]);
    expect(sections[0].text).toBe(`${long}\n\nDiastole is relaxation.`);
    expect(sections[0].id).toBe("c0");
  });

  it("keeps files without pages as one section", () => {
    const sections = groupPassages([chunk(0, null, "One."), chunk(1, null, "Two.")]);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ location: null, number: null, text: "One.\n\nTwo." });
  });
});

describe("search", () => {
  const sections = groupPassages([chunk(0, "Page 1", "Aorta and AORTA."), chunk(1, "Page 2", "Veins.")]);

  it("counts case-insensitively", () => {
    expect(countMatches("Aorta and AORTA.", "aorta")).toBe(2);
    expect(countMatches("anything", "  ")).toBe(0);
  });

  it("filters sections and matches the page label too", () => {
    expect(searchSections(sections, "aorta").map(r => [r.section.location, r.matches])).toEqual([["Page 1", 2]]);
    expect(searchSections(sections, "page 2").map(r => r.section.location)).toEqual(["Page 2"]);
    expect(searchSections(sections, "")).toHaveLength(2);
  });
});

describe("readingProgress", () => {
  it("shows the page being read", () => {
    expect(readingProgress({ status: "processing", kind: "pdf", pagesRead: 15, pageCount: 40 })).toEqual({ label: "Reading page 16 of 40…", value: 38 });
    expect(readingProgress({ status: "processing", kind: "pdf", pagesRead: 40, pageCount: 40 })).toEqual({ label: "Almost done…", value: 100 });
    expect(readingProgress({ status: "processing", kind: "pdf", pagesRead: 0, pageCount: 40 })).toEqual({ label: "Reading page 1 of 40…", value: 0 });
    expect(readingProgress({ status: "processing", kind: "pptx", pagesRead: 0, pageCount: null })).toEqual({ label: "Reading this file…", value: null });
    expect(readingProgress({ status: "queued", kind: "pdf", pagesRead: 0, pageCount: null })?.label).toBe("Waiting its turn…");
    expect(readingProgress({ status: "ready", kind: "pdf", pagesRead: 40, pageCount: 40 })).toBeNull();
  });
});

describe("aiReadSummary", () => {
  it("describes what the AI looked at", () => {
    expect(aiReadSummary({ kind: "pdf", visionPages: 40, visionFigures: 0, pageCount: 40 })).toBe("Read by AI: 40 of 40 pages");
    expect(aiReadSummary({ kind: "docx", visionPages: 0, visionFigures: 1, pageCount: null })).toBe("1 figure read by AI");
    expect(aiReadSummary({ kind: "image", visionPages: 1, visionFigures: 0, pageCount: 1 })).toBe("Read by AI");
    expect(aiReadSummary({ kind: "text", visionPages: 0, visionFigures: 0, pageCount: null })).toBeNull();
    expect(aiReadBadge({ kind: "pdf", visionPages: 40, visionFigures: 0, pageCount: 40 })).toBe("Read by AI");
    expect(aiReadBadge({ kind: "pdf", visionPages: 12, visionFigures: 0, pageCount: 40 })).toBe("AI read 12 of 40 pages");
    expect(aiReadBadge({ kind: "docx", visionPages: 0, visionFigures: 2, pageCount: null })).toBe("2 figures read by AI");
  });
});

describe("plainExcerpt", () => {
  it("strips Markdown syntax but keeps the words", () => {
    expect(plainExcerpt("### Lecture 3: The Heart\n\nThe **mitral** valve, *left* side, `code`.")).toBe("Lecture 3: The Heart\n\nThe mitral valve, left side, code.");
    expect(plainExcerpt("| Input | Output |\n|---|---|\n| CO2 | O2 |")).toBe("Input · Output\n\nCO2 · O2");
    expect(plainExcerpt("> quoted [link](http://x) and 2 * 3 = 6")).toBe("quoted link and 2 * 3 = 6");
  });
});
