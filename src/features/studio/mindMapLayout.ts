import dagre from "@dagrejs/dagre";
import type { MindMapNode } from "../../lib/learningApi.ts";

export const NODE_WIDTH = 220;
const NODE_HEIGHT = 64;

export type Positions = Record<string, { x: number; y: number }>;

/** Ids of every node under `id` (not including it). */
export function descendantsOf(nodes: MindMapNode[], id: string): Set<string> {
  const children = new Map<string, string[]>();
  nodes.forEach(node => node.parentId && children.set(node.parentId, [...(children.get(node.parentId) ?? []), node.id]));
  const found = new Set<string>();
  const stack = [...(children.get(id) ?? [])];
  while (stack.length) {
    const next = stack.pop()!;
    if (found.has(next)) continue;
    found.add(next);
    stack.push(...(children.get(next) ?? []));
  }
  return found;
}

/** Nodes hidden because an ancestor is collapsed. */
export function hiddenBy(nodes: MindMapNode[], collapsed: Set<string>): Set<string> {
  const hidden = new Set<string>();
  collapsed.forEach(id => descendantsOf(nodes, id).forEach(child => hidden.add(child)));
  return hidden;
}

/** A tidy left-to-right tree layout of the visible nodes (top-left positions). */
export function layoutTree(nodes: MindMapNode[]): Positions {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", nodesep: 18, ranksep: 70, marginx: 20, marginy: 20 });
  graph.setDefaultEdgeLabel(() => ({}));
  const ids = new Set(nodes.map(node => node.id));
  nodes.forEach(node => graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  nodes.forEach(node => node.parentId && ids.has(node.parentId) && graph.setEdge(node.parentId, node.id));
  dagre.layout(graph);

  return Object.fromEntries(
    nodes.map(node => {
      const { x, y } = graph.node(node.id);
      return [node.id, { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 }];
    }),
  );
}

/** Where the user dragged things, per map and per browser. Never required: a fresh layout is always fine. */
export const savedLayout = {
  key: (itemId: string) => `smartquiz.mindmap.${itemId}`,
  read(itemId: string): { positions: Positions; collapsed: string[] } | null {
    try {
      const raw = localStorage.getItem(this.key(itemId));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  write(itemId: string, value: { positions: Positions; collapsed: string[] }) {
    try {
      localStorage.setItem(this.key(itemId), JSON.stringify(value));
    } catch {
      /* storage blocked or full: the layout just won't be remembered */
    }
  },
  clear(itemId: string) {
    try {
      localStorage.removeItem(this.key(itemId));
    } catch {
      /* ignore */
    }
  },
};
