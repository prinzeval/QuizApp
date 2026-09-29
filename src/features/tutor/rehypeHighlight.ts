import type { Element, ElementContent, Root, RootContent } from "hast";

const SKIP = new Set(["code", "pre", "script", "style", "mark"]);

const isMath = (node: Element) => {
  const className = node.properties?.className;
  return Array.isArray(className) && className.some(name => String(name).startsWith("katex"));
};

/** Splits one text value around case-insensitive matches of `query` (already lower-cased). */
export function splitMatches(value: string, query: string): ElementContent[] {
  const lower = value.toLowerCase();
  const out: ElementContent[] = [];
  let last = 0;
  for (let index = lower.indexOf(query); index !== -1; index = lower.indexOf(query, last)) {
    if (index > last) out.push({ type: "text", value: value.slice(last, index) });
    out.push({ type: "element", tagName: "mark", properties: {}, children: [{ type: "text", value: value.slice(index, index + query.length) }] });
    last = index + query.length;
  }
  if (last === 0) return [{ type: "text", value }];
  if (last < value.length) out.push({ type: "text", value: value.slice(last) });
  return out;
}

/** Rehype plugin: wraps matches of `needle` in <mark>, leaving code and rendered math alone. */
export function rehypeHighlight({ needle }: { needle: string }) {
  const query = needle.trim().toLowerCase();
  const walk = (node: Root | Element) => {
    const children: RootContent[] = [];
    for (const child of node.children as RootContent[]) {
      if (child.type === "text") children.push(...splitMatches(child.value, query));
      else {
        if (child.type === "element" && !SKIP.has(child.tagName) && !isMath(child)) walk(child);
        children.push(child);
      }
    }
    node.children = children as typeof node.children;
  };
  return (tree: Root) => {
    if (query) walk(tree);
  };
}
