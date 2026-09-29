import type { Material, MaterialChunk } from "../../../lib/learningApi.ts";

/** One page / slide of what the AI read: consecutive passages from the same place, merged. */
export interface PassageSection {
  /** Stable key: the first chunk's id. */
  id: string;
  /** "Page 7", "Slide 2", or null when the file has no pages (DOCX, text, images). */
  location: string | null;
  /** 7 for "Page 7" / "Slide 7", else null. */
  number: number | null;
  /** Markdown, with the ~200-character overlap between neighbouring passages removed. */
  text: string;
}

/** "Page 7" → 7, "Slide 12" → 12, anything else → null. */
export function locationNumber(location: string | null | undefined): number | null {
  const match = location?.trim().match(/^(?:page|slide)\s+(\d+)$/i);
  return match ? Number(match[1]) : null;
}

/** The PDF page a source points at, when it points at one. */
export function pdfPageOf(kind: Material["kind"] | undefined, location: string | null | undefined): number | null {
  return kind === "pdf" && /^page\s/i.test(location?.trim() ?? "") ? locationNumber(location) : null;
}

const MIN_OVERLAP = 12;
const MAX_OVERLAP = 400;

/**
 * The backend starts each passage with the last ~200 characters of the previous
 * one (cut at a word boundary) followed by a blank line, so an idea split at a
 * boundary is whole in one of them. Reading them back to back, drop that repeat.
 */
export function joinWithoutOverlap(previous: string, next: string): string {
  const prev = previous.trimEnd();
  const upper = Math.min(prev.length, next.length, MAX_OVERLAP);
  for (let size = upper; size >= MIN_OVERLAP; size--) {
    const tail = prev.slice(-size);
    if (next.startsWith(tail) && (next.length === size || /^\s*\n/.test(next.slice(size)))) {
      const rest = next.slice(size).trim();
      return rest ? `${prev}\n\n${rest}` : prev;
    }
  }
  return `${prev}\n\n${next.trim()}`;
}

/** Groups passages by page/slide in reading order, merging neighbours from the same place. */
export function groupPassages(chunks: MaterialChunk[]): PassageSection[] {
  const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  const sections: PassageSection[] = [];
  for (const chunk of sorted) {
    const last = sections[sections.length - 1];
    if (last && last.location === chunk.location) {
      last.text = joinWithoutOverlap(last.text, chunk.content);
    } else {
      sections.push({ id: chunk.id, location: chunk.location, number: locationNumber(chunk.location), text: chunk.content.trim() });
    }
  }
  // Keep pages in page order even if a figure description was appended out of place.
  if (sections.every(section => section.number !== null)) {
    sections.sort((a, b) => a.number! - b.number!);
  }
  return sections;
}

/** Case-insensitive, non-overlapping occurrences of `needle` in `text`. */
export function countMatches(text: string, needle: string): number {
  const lowerNeedle = needle.trim().toLowerCase();
  if (!lowerNeedle) return 0;
  const lowerText = text.toLowerCase();
  let count = 0;
  for (let i = lowerText.indexOf(lowerNeedle); i !== -1; i = lowerText.indexOf(lowerNeedle, i + lowerNeedle.length)) count++;
  return count;
}

/** Sections that mention `needle` (in the text or the "Page 7" label), with how often. */
export function searchSections(sections: PassageSection[], needle: string): { section: PassageSection; matches: number }[] {
  const query = needle.trim();
  if (!query) return sections.map(section => ({ section, matches: 0 }));
  return sections
    .map(section => ({ section, matches: countMatches(section.text, query) + countMatches(section.location ?? "", query) }))
    .filter(result => result.matches > 0);
}

/** "Reading page 16 of 40…", "Waiting its turn…" — or null once it's done. */
export function readingProgress(material: Pick<Material, "status" | "kind" | "pagesRead" | "pageCount">): { label: string; value: number | null } | null {
  if (material.status === "queued") return { label: "Waiting its turn…", value: null };
  if (material.status !== "processing") return null;
  const unit = material.kind === "pptx" ? "slide" : "page";
  const total = material.pageCount ?? 0;
  if (total > 1) {
    const current = Math.min(material.pagesRead + (material.pagesRead < total ? 1 : 0), total);
    return {
      label: material.pagesRead >= total ? "Almost done…" : `Reading ${unit} ${current} of ${total}…`,
      value: Math.round((material.pagesRead / total) * 100),
    };
  }
  return { label: "Reading this file…", value: null };
}

/** A compact label for lists: "Read by AI" when it read everything, else "AI read 12 of 40 pages". */
export function aiReadBadge(material: Pick<Material, "kind" | "visionPages" | "visionFigures" | "pageCount">): string | null {
  const total = material.pageCount ?? material.visionPages;
  if (material.visionPages > 0 && material.visionPages < total) return `AI read ${material.visionPages} of ${total} pages`;
  if (material.visionPages > 0) return "Read by AI";
  return aiReadSummary(material);
}

/** "Read by AI: 40 of 40 pages", "3 figures read by AI" — or null when the AI didn't look at anything. */
export function aiReadSummary(material: Pick<Material, "kind" | "visionPages" | "visionFigures" | "pageCount">): string | null {
  if (material.kind === "image" && material.visionPages > 0) return "Read by AI";
  if (material.visionPages > 0) {
    const total = material.pageCount ?? material.visionPages;
    return `Read by AI: ${material.visionPages} of ${total} ${total === 1 ? "page" : "pages"}`;
  }
  if (material.visionFigures > 0) {
    return `${material.visionFigures} ${material.visionFigures === 1 ? "figure" : "figures"} read by AI`;
  }
  return null;
}

/** Markdown → readable plain text for short excerpts (citations, quiz sources) where we don't render Markdown. */
export function plainExcerpt(markdown: string): string {
  return markdown
    .replace(/^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(\|[ \t]*:?-{3,}:?[ \t]*)*\|?[ \t]*$/gm, "") // table separator rows
    .replace(/^[ \t]*\|(.*)\|[ \t]*$/gm, (_, row: string) => row.split("|").map(cell => cell.trim()).join(" · ")) // table rows
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)\*(?!\w)/g, "$1$2")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
