/** Every React Query key in one place, so realtime events can invalidate precisely. */
export const queryKeys = {
  rooms: ["rooms"] as const,
  room: (roomId: string) => ["rooms", roomId] as const,
  materials: (roomId: string) => ["rooms", roomId, "materials"] as const,
  material: (roomId: string, materialId: string) => ["rooms", roomId, "materials", materialId] as const,
  invites: (roomId: string) => ["rooms", roomId, "invites"] as const,
  quizzes: (roomId: string) => ["rooms", roomId, "quizzes"] as const,
  quiz: (roomId: string, quizId: string) => ["rooms", roomId, "quizzes", quizId] as const,
  attempt: (roomId: string, quizId: string, attemptId: string) => ["rooms", roomId, "quizzes", quizId, "attempts", attemptId] as const,
  studio: (roomId: string) => ["rooms", roomId, "studio"] as const,
  studioItem: (roomId: string, itemId: string) => ["rooms", roomId, "studio", itemId] as const,
  // Pictures from Word/PowerPoint files never change either.
  figureImage: (roomId: string, figureId: string) => ["figureImage", roomId, figureId] as const,
  progress: (roomId: string) => ["rooms", roomId, "progress"] as const,
  conversations: (roomId: string) => ["rooms", roomId, "tutor"] as const,
  conversation: (roomId: string, conversationId: string) => ["rooms", roomId, "tutor", conversationId] as const,
  invitePreview: (token: string) => ["invite", token] as const,
  // Outside "rooms" on purpose: the original file never changes, so room/material refreshes shouldn't refetch it.
  materialFile: (roomId: string, materialId: string) => ["materialFile", roomId, materialId] as const,
  pdfDocument: (roomId: string, materialId: string) => ["pdfDocument", roomId, materialId] as const,
};
