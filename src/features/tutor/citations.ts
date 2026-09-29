import type { UIMessage } from "ai";
import type { Link, Parent, PhrasingContent, Root, RootContent, Text } from "mdast";
import type { TutorSource } from "../../lib/learningApi.ts";

/** A tutor chat message: text parts plus the `data-sources` part the server sends before the answer. */
export type TutorUIMessage = UIMessage<unknown, { sources: TutorSource[] }>;

/** Citation links point here; the Markdown renderer turns them into source chips. */
export const CITATION_PREFIX = "#cite-";

/** "[S1]", "[S1, S3]", "[S1; S2]" (the model is told to use "[S1]", but groups happen). */
const CITATION = /\[(S\d+(?:\s*[,;]\s*S\d+)*)\]/g;

/** Splits one text value into plain text and citation links. */
export function splitCitations(value: string): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  let last = 0;
  for (const match of value.matchAll(CITATION)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ type: "text", value: value.slice(last, index) });
    for (const tag of match[1].split(/\s*[,;]\s*/)) {
      out.push({ type: "link", url: `${CITATION_PREFIX}${tag}`, children: [{ type: "text", value: tag }] } satisfies Link);
    }
    last = index + match[0].length;
  }
  if (last === 0) return [{ type: "text", value }];
  if (last < value.length) out.push({ type: "text", value: value.slice(last) });
  return out;
}

/**
 * Remark plugin: turns "[S1]" in prose into links to `#cite-S1`. Code (inline or
 * block) is left alone because its content isn't made of text nodes, and
 * existing links are skipped so we never nest links.
 */
export function remarkCitations() {
  const walk = (node: Parent) => {
    const next: RootContent[] = [];
    let changed = false;
    for (const child of node.children as RootContent[]) {
      if (child.type === "text") {
        const parts = splitCitations((child as Text).value);
        if (parts.length > 1 || parts[0].type !== "text") changed = true;
        next.push(...parts);
        continue;
      }
      if (child.type !== "link" && child.type !== "linkReference" && "children" in child) walk(child as Parent);
      next.push(child);
    }
    if (changed) node.children = next as Parent["children"];
  };
  return (tree: Root) => walk(tree);
}

/** Tags cited in the text, in order of first appearance ("S2", "S1"). */
export function citedTags(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(CITATION)) for (const tag of match[1].split(/\s*[,;]\s*/)) seen.add(tag);
  return [...seen];
}

export function messageText(message: TutorUIMessage): string {
  return message.parts.flatMap(part => (part.type === "text" ? [part.text] : [])).join("\n\n");
}

export function messageSources(message: TutorUIMessage): TutorSource[] {
  for (const part of message.parts) if (part.type === "data-sources") return part.data;
  return [];
}

/** The chat endpoint answers errors with a JSON body; the SDK puts that body in `error.message`. */
export function chatErrorMessage(error: Error): string {
  try {
    const body = JSON.parse(error.message) as { message?: string; validationErrors?: { message: string }[] };
    const message = body.validationErrors?.[0]?.message ?? body.message;
    if (message) return message;
  } catch {
    /* plain text */
  }
  if (/failed to fetch|network/i.test(error.message)) return "Couldn't reach the tutor. Check your connection and try again.";
  return error.message || "Something went wrong. Please try again.";
}
