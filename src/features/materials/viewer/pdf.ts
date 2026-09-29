/**
 * The one place react-pdf is configured. Import Document/Page from here, never from
 * "react-pdf" directly: the worker has to be set in the module that loads react-pdf.
 */
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { useMaterialFile } from "../../../hooks/materialFile.ts";
import { queryKeys } from "../../../hooks/queryKeys.ts";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

// Copied to /pdfjs/ by vite.config.ts.
const assets = `${import.meta.env.BASE_URL}pdfjs/`;

/** Stable (module-level) so react-pdf doesn't reload the document on every render. */
export const pdfOptions = {
  cMapUrl: `${assets}cmaps/`,
  standardFontDataUrl: `${assets}standard_fonts/`,
  wasmUrl: `${assets}wasm/`,
  iccUrl: `${assets}iccs/`,
};

/** Sharp on retina, but never huge canvases on 3x phones. */
export const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2);

const watched = new WeakSet<QueryClient>();

/**
 * A parsed PDF shared by every page thumbnail of one material (e.g. several citations of
 * the same lecture), so the file is fetched and parsed once. Destroyed when unused.
 */
export function usePdfDocument(roomId: string, materialId: string) {
  const queryClient = useQueryClient();
  if (!watched.has(queryClient)) {
    watched.add(queryClient);
    queryClient.getQueryCache().subscribe(event => {
      if (event.type === "removed" && event.query.queryKey[0] === "pdfDocument") {
        void (event.query.state.data as PDFDocumentProxy | undefined)?.loadingTask.destroy();
      }
    });
  }
  const file = useMaterialFile(roomId, materialId);
  const url = file.data?.url;
  const document = useQuery({
    queryKey: queryKeys.pdfDocument(roomId, materialId),
    queryFn: () => pdfjs.getDocument({ url: url!, ...pdfOptions }).promise,
    enabled: !!url,
    staleTime: Infinity,
    gcTime: 2 * 60_000,
    structuralSharing: false,
    retry: false,
  });
  return { pdf: document.data, error: file.error ?? document.error, isPending: file.isPending || document.isPending };
}

export { Document, Page, pdfjs };
export type { PDFDocumentProxy };
