import { Skeleton } from "@mantine/core";
import { Page, pixelRatio, usePdfDocument } from "../materials/viewer/pdf.ts";
import { Unavailable } from "./Unavailable.tsx";

/** Biggest canvas side we'll ask for: huge crops of a tiny region would exhaust phone memory. */
const MAX_CANVAS = 4096;

/** One PDF page drawn at `pageWidth` CSS pixels (the crop frame hides all but the figure). */
export default function PdfPage({ roomId, materialId, page, pageWidth }: { roomId: string; materialId: string; page: number; pageWidth: number }) {
  const { pdf, error } = usePdfDocument(roomId, materialId);
  if (error) return <Unavailable />;
  if (!pdf) return <Skeleton h="100%" radius={0} />;
  // Round so resizing by a pixel doesn't re-render the canvas.
  const cssWidth = Math.round(pageWidth);
  return (
    <Page
      pdf={pdf}
      pageNumber={page}
      width={cssWidth}
      devicePixelRatio={Math.min(pixelRatio(), MAX_CANVAS / Math.max(cssWidth, 1))}
      renderTextLayer={false}
      renderAnnotationLayer={false}
      suspense={false}
      loading={<Skeleton h="100%" radius={0} />}
      error={<Unavailable />}
    />
  );
}
