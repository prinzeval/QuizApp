import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { fetchMaterialFile } from "../lib/learningApi.ts";
import { queryKeys } from "./queryKeys.ts";

export interface MaterialFile {
  blob: Blob;
  /** A blob: URL for <img>, pdf.js and downloads. Revoked when the cache drops the file. */
  url: string;
}

const watched = new WeakSet<QueryClient>();

/** Frees blob URLs (and anything else heavy) when React Query garbage-collects them. */
function releaseOnRemove(queryClient: QueryClient) {
  if (watched.has(queryClient)) return;
  watched.add(queryClient);
  queryClient.getQueryCache().subscribe(event => {
    if (event.type !== "removed" || event.query.queryKey[0] !== "materialFile") return;
    const file = event.query.state.data as MaterialFile | undefined;
    if (file) URL.revokeObjectURL(file.url);
  });
}

/**
 * The original uploaded file, fetched once (it needs auth, so it's a blob) and shared by
 * the viewer, the "How the AI reads this file" thumbnails and citation thumbnails.
 */
export function useMaterialFile(roomId: string, materialId: string, enabled = true) {
  const queryClient = useQueryClient();
  releaseOnRemove(queryClient);
  return useQuery({
    queryKey: queryKeys.materialFile(roomId, materialId),
    queryFn: async (): Promise<MaterialFile> => {
      const blob = await fetchMaterialFile(roomId, materialId);
      return { blob, url: URL.createObjectURL(blob) };
    },
    enabled: enabled && !!roomId && !!materialId,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    structuralSharing: false,
  });
}
