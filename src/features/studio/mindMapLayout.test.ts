import { describe, expect, it } from "vitest";
import type { MindMapNode } from "../../lib/learningApi.ts";
import { NODE_WIDTH, descendantsOf, hiddenBy, layoutTree } from "./mindMapLayout.ts";

const node = (id: string, parentId: string | null): MindMapNode => ({ id, label: id, summary: "", parentId, sources: [], figureIds: [] });
const tree = [node("root", null), node("a", "root"), node("a1", "a"), node("a2", "a"), node("b", "root"), node("b1", "b")];

describe("mind map layout", () => {
  it("finds everything under a topic", () => {
    expect([...descendantsOf(tree, "a")].sort()).toEqual(["a1", "a2"]);
    expect(descendantsOf(tree, "root").size).toBe(5);
    expect(descendantsOf(tree, "b1").size).toBe(0);
  });

  it("hides the branches of folded topics", () => {
    expect([...hiddenBy(tree, new Set(["a"]))].sort()).toEqual(["a1", "a2"]);
    expect(hiddenBy(tree, new Set()).size).toBe(0);
  });

  it("lays the tree out left to right with no overlaps", () => {
    const positions = layoutTree(tree);
    expect(Object.keys(positions).sort()).toEqual(tree.map(n => n.id).sort());
    // Children sit to the right of their parent.
    expect(positions.a.x).toBeGreaterThan(positions.root.x + NODE_WIDTH / 2);
    expect(positions.a1.x).toBeGreaterThan(positions.a.x + NODE_WIDTH / 2);
    // Siblings don't overlap.
    expect(Math.abs(positions.a1.y - positions.a2.y)).toBeGreaterThanOrEqual(60);
  });
});
