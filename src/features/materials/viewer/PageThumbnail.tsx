import { useEffect, useRef, useState } from "react";
import { Box, Center, Skeleton, Text } from "@mantine/core";
import { IconFileOff } from "@tabler/icons-react";
import { Page, pixelRatio, usePdfDocument, type PDFDocumentProxy } from "./pdf.ts";

/** Letter/A4-ish until the page tells us its real shape. */
const DEFAULT_RATIO = 1.3;

/** True once the element has come near the screen (then stays true). */
function useSeen<T extends Element>(margin = "300px") {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || seen) return;
    const observer = new IntersectionObserver(entries => entries.some(entry => entry.isIntersecting) && setSeen(true), { rootMargin: margin });
    observer.observe(element);
    return () => observer.disconnect();
  }, [seen, margin]);
  return [ref, seen] as const;
}

function Frame({ width, ratio, children, label }: { width: number; ratio: number; children: React.ReactNode; label: string }) {
  return (
    <Box
      w={width}
      h={Math.round(width * ratio)}
      bg="white"
      role="img"
      aria-label={label}
      style={{
        flexShrink: 0,
        overflow: "hidden",
        borderRadius: 6,
        border: "1px solid var(--mantine-color-default-border)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
      }}
    >
      {children}
    </Box>
  );
}

function Unavailable({ width, ratio }: { width: number; ratio: number }) {
  return (
    <Frame width={width} ratio={ratio} label="Page preview unavailable">
      <Center h="100%" c="gray.6">
        <IconFileOff size={Math.max(16, width / 5)} stroke={1.5} aria-hidden="true" />
      </Center>
    </Frame>
  );
}

/** A small, non-interactive render of one PDF page (no text layer). Renders when scrolled near. */
export function PdfPageThumbnail({ pdf, page, width }: { pdf: PDFDocumentProxy | undefined; page: number; width: number }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  const [failed, setFailed] = useState(false);
  const outOfRange = !!pdf && (page < 1 || page > pdf.numPages);

  if (failed || outOfRange) return <Unavailable width={width} ratio={ratio} />;

  return (
    <div ref={ref} data-testid="page-thumbnail" data-page={page}>
      <Frame width={width} ratio={ratio} label={`Page ${page}`}>
        {pdf && seen ? (
          <Page
            pdf={pdf}
            pageNumber={page}
            width={width}
            devicePixelRatio={pixelRatio()}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            suspense={false}
            loading={<Skeleton w={width} h={Math.round(width * ratio)} radius={0} />}
            error={<Unavailable width={width} ratio={ratio} />}
            onLoadSuccess={loaded => setRatio(loaded.originalHeight / loaded.originalWidth)}
            onLoadError={() => setFailed(true)}
          />
        ) : (
          <Skeleton w={width} h={Math.round(width * ratio)} radius={0} />
        )}
      </Frame>
    </div>
  );
}

/** A page thumbnail straight from a material (fetches and parses the PDF once, shared). */
export default function MaterialPageThumbnail({ roomId, materialId, page, width }: { roomId: string; materialId: string; page: number; width: number }) {
  const { pdf, error } = usePdfDocument(roomId, materialId);
  if (error) {
    return (
      <Box>
        <Unavailable width={width} ratio={DEFAULT_RATIO} />
        <Text size="xs" c="dimmed" mt={4} maw={width}>
          Preview unavailable
        </Text>
      </Box>
    );
  }
  return <PdfPageThumbnail pdf={pdf} page={page} width={width} />;
}
