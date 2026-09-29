import "katex/dist/katex.min.css";
import { memo, useMemo, type ReactNode } from "react";
import ReactMarkdown, { type Components, type Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Box, Typography } from "@mantine/core";
import { CITATION_PREFIX, remarkCitations } from "./citations.ts";
import { rehypeHighlight } from "./rehypeHighlight.ts";
import classes from "./Markdown.module.css";

type PluggableList = NonNullable<Options["rehypePlugins"]>;

const plainPlugins: PluggableList = [remarkGfm, remarkMath];
const citationPlugins: PluggableList = [remarkGfm, remarkMath, remarkCitations];
const rehypePlugins: PluggableList = [rehypeKatex];

interface MarkdownProps {
  text: string;
  /** Renders "[S1]" citations (tutor answers). Without it, "[S1]" stays plain text. */
  renderCitation?: (tag: string) => ReactNode;
  /** Marks every match of this text (search results). */
  highlight?: string;
  /** "sm" for compact panels; the default reads comfortably in a chat. */
  size?: "sm" | "md";
}

/** Markdown with GFM tables and KaTeX math: tutor answers and what the AI read from a file. */
export const Markdown = memo(function Markdown({ text, renderCitation, highlight = "", size = "md" }: MarkdownProps) {
  const components = useMemo<Components>(
    () => ({
      a: ({ node: _node, href, children, ...props }) => {
        if (renderCitation && href?.startsWith(CITATION_PREFIX)) return renderCitation(href.slice(CITATION_PREFIX.length));
        return (
          <a href={href} target="_blank" rel="noreferrer noopener" {...props}>
            {children}
          </a>
        );
      },
      table: ({ node: _node, ...props }) => (
        <Box mb="md" style={{ overflowX: "auto" }}>
          <table {...props} />
        </Box>
      ),
    }),
    [renderCitation],
  );
  const needle = highlight.trim();
  const rehype = useMemo<PluggableList>(() => (needle ? [...rehypePlugins, [rehypeHighlight, { needle }]] : rehypePlugins), [needle]);

  return (
    <Typography
      className={classes.root}
      data-size={size}
      fz={size === "sm" ? 14 : { base: 15, sm: 16 }}
      lh={size === "sm" ? 1.6 : 1.65}
      style={{ overflowWrap: "anywhere" }}
    >
      <ReactMarkdown remarkPlugins={renderCitation ? citationPlugins : plainPlugins} rehypePlugins={rehype} components={components}>
        {text}
      </ReactMarkdown>
    </Typography>
  );
});
