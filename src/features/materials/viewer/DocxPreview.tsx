import { useEffect, useRef, useState } from "react";
import { Alert, Box, Skeleton, Stack, Text } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { IconAlertCircle } from "@tabler/icons-react";
import classes from "./DocxPreview.module.css";

/** A Word document drawn page by page in the browser (docx-preview), scaled to fit narrow screens. */
export default function DocxPreview({ blob, downloadAction }: { blob: Blob; downloadAction: React.ReactNode }) {
  const body = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [pageWidth, setPageWidth] = useState(816);
  const { ref: frame, width } = useElementSize<HTMLDivElement>();

  useEffect(() => {
    const container = body.current;
    if (!container) return;
    let cancelled = false;
    setState("loading");
    void (async () => {
      try {
        const { renderAsync } = await import("docx-preview");
        container.replaceChildren();
        await renderAsync(blob, container, container, {
          className: "docx",
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          useBase64URL: true,
        });
        if (cancelled) return;
        const widths = [...container.querySelectorAll<HTMLElement>("section.docx")].map(section => section.offsetWidth);
        setPageWidth(Math.max(816, ...widths));
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blob]);

  // Fit the page to the screen on phones; never enlarge past 100%.
  const scale = width > 0 ? Math.min(1, width / pageWidth) : 1;

  return (
    <Box ref={frame} data-testid="docx-preview">
      {state === "loading" && (
        <Stack align="center" aria-busy="true" aria-label="Loading document">
          <Skeleton w={Math.min(816, width || 816)} h={Math.min(1056, (width || 816) * 1.3)} radius="sm" />
        </Stack>
      )}
      {state === "error" && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title="This document couldn't be shown here">
          <Text size="sm" mb="sm">
            Some Word features can't be drawn in the browser. You can still download the original.
          </Text>
          {downloadAction}
        </Alert>
      )}
      <div
        ref={body}
        className={classes.root}
        style={{ zoom: scale, display: state === "error" ? "none" : undefined, visibility: state === "loading" ? "hidden" : undefined, height: state === "loading" ? 0 : undefined }}
      />
    </Box>
  );
}
