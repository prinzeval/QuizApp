import { describe, expect, it } from "vitest";
import type { Root } from "mdast";
import { chatErrorMessage, citedTags, remarkCitations, splitCitations } from "./citations.ts";

describe("splitCitations", () => {
  it("turns [S1] and grouped tags into citation links", () => {
    const parts = splitCitations("The mitral valve closes [S1]. Both [S2, S3] agree.");
    expect(parts.map(p => (p.type === "link" ? `<${p.url}>` : p.type === "text" ? p.value : p.type))).toEqual([
      "The mitral valve closes ",
      "<#cite-S1>",
      ". Both ",
      "<#cite-S2>",
      "<#cite-S3>",
      " agree.",
    ]);
  });

  it("leaves text without citations alone", () => {
    expect(splitCitations("No sources here [x]")).toEqual([{ type: "text", value: "No sources here [x]" }]);
  });
});

describe("remarkCitations", () => {
  it("rewrites prose but not code", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "text", value: "See [S2]" },
            { type: "inlineCode", value: "[S1]" },
          ],
        },
        { type: "code", value: "[S3]" },
      ],
    };
    remarkCitations()(tree);
    const paragraph = tree.children[0] as { children: { type: string }[] };
    expect(paragraph.children.map(c => c.type)).toEqual(["text", "link", "inlineCode"]);
    expect(tree.children[1]).toEqual({ type: "code", value: "[S3]" });
  });
});

describe("citedTags", () => {
  it("lists tags once, in order of appearance", () => {
    expect(citedTags("a [S2] b [S1] c [S2; S3]")).toEqual(["S2", "S1", "S3"]);
  });
});

describe("chatErrorMessage", () => {
  it("reads the server's JSON message", () => {
    expect(chatErrorMessage(new Error(JSON.stringify({ message: "The AI tutor isn't set up yet." })))).toBe("The AI tutor isn't set up yet.");
  });
  it("falls back to plain text", () => {
    expect(chatErrorMessage(new Error("Boom"))).toBe("Boom");
  });
});
