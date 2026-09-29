/** The material viewer, optionally opened at a PDF page. */
export const viewerPath = (roomId: string, materialId: string, page?: number | null) =>
  `/rooms/${roomId}/materials/${materialId}${page ? `?page=${page}` : ""}`;
