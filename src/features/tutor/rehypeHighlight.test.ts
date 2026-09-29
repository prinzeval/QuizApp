import { describe, expect, it } from "vitest";
import type { Root } from "hast";
import { rehypeHighlight, splitMatches } from "./rehypeHighlight.ts";

describe("splitMatches", () => {
  it("wraps case-insensitive matches in <mark>, keeping the original case", () => {
    const parts = splitMatches("The Aorta and the aorta", "aorta");
    expect(parts.map(p => (p.type === "text" ? p.value : p.type === "element" ? `<${(p.children[0] as { value: string }).value}>` : ""))).toEqual([
      "The ",
      "<Aorta>",
      " and the ",
      "<aorta>",
    ]);
  });

  it("leaves text without matches alone", () => {
    expect(splitMatches("nothing here", "aorta")).toEqual([{ type: "text", value: "nothing here" }]);
  });
});

describe("rehypeHighlight", () => {
  it("skips code and rendered math", () => {
    const tree: Root = {
      type: "root",
      children: [
        { type: "element", tagName: "p", properties: {}, children: [{ type: "text", value: "x is x" }] },
        { type: "element", tagName: "code", properties: {}, children: [{ type: "text", value: "x" }] },
        { type: "element", tagName: "span", properties: { className: ["katex"] }, children: [{ type: "text", value: "x" }] },
      ],
    };
    rehypeHighlight({ needle: "X" })(tree);
    const marks = JSON.stringify(tree).match(/"mark"/g) ?? [];
    expect(marks).toHaveLength(2);
  });
});
