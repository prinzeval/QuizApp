import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { learningApi, uploadMaterials, type NewQuizInput, type QuizMode, type StudioKind } from "../lib/learningApi.ts";
import { queryKeys } from "./queryKeys.ts";

/* -------------------------------------------------------------- materials */

export function useMaterials(roomId: string) {
  return useQuery({ queryKey: queryKeys.materials(roomId), queryFn: () => learningApi.materials(roomId) });
}

export function useMaterial(roomId: string, materialId: string | null) {
  return useQuery({
    queryKey: queryKeys.material(roomId, materialId ?? ""),
    queryFn: () => learningApi.material(roomId, materialId!),
    enabled: !!materialId,
  });
}

export function useUploadMaterials(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ files, onProgress }: { files: File[]; onProgress?: (fraction: number) => void }) => uploadMaterials(roomId, files, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materials(roomId), exact: true });
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms, exact: true });
    },
  });
}

export function useDeleteMaterial(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (materialId: string) => learningApi.deleteMaterial(roomId, materialId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.materials(roomId), exact: true }),
  });
}

export function useRetryMaterial(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (materialId: string) => learningApi.retryMaterial(roomId, materialId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.materials(roomId), exact: true }),
  });
}

/* ------------------------------------------------------- invites & members */

export function useInvites(roomId: string, enabled = true) {
  return useQuery({ queryKey: queryKeys.invites(roomId), queryFn: () => learningApi.invites(roomId), enabled });
}

export function useCreateInvite(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { expiresInDays: 1 | 7 | 30 | null; maxUses: number | null }) => learningApi.createInvite(roomId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.invites(roomId) }),
  });
}

export function useRevokeInvite(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => learningApi.revokeInvite(roomId, inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.invites(roomId) }),
  });
}

export function useInvitePreview(token: string) {
  return useQuery({ queryKey: queryKeys.invitePreview(token), queryFn: () => learningApi.invitePreview(token), retry: false });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => learningApi.acceptInvite(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.rooms, exact: true }),
  });
}

export function useRemoveMember(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => learningApi.removeMember(roomId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId), exact: true }),
  });
}

export function useLeaveRoom(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => learningApi.leaveRoom(roomId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.room(roomId) });
      return queryClient.invalidateQueries({ queryKey: queryKeys.rooms, exact: true });
    },
  });
}

/* ---------------------------------------------------------------- quizzes */

export function useQuizzes(roomId: string) {
  return useQuery({ queryKey: queryKeys.quizzes(roomId), queryFn: () => learningApi.quizzes(roomId) });
}

export function useQuiz(roomId: string, quizId: string) {
  return useQuery({ queryKey: queryKeys.quiz(roomId, quizId), queryFn: () => learningApi.quiz(roomId, quizId) });
}

export function useCreateQuiz(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewQuizInput) => learningApi.createQuiz(roomId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.quizzes(roomId), exact: true }),
  });
}

export function useDeleteQuiz(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quizId: string) => learningApi.deleteQuiz(roomId, quizId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.quizzes(roomId), exact: true }),
  });
}

export function useRetryQuiz(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quizId: string) => learningApi.retryQuiz(roomId, quizId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.quizzes(roomId), exact: true }),
  });
}

export function useStartAttempt(roomId: string, quizId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mode: QuizMode) => learningApi.startAttempt(roomId, quizId, mode),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.quiz(roomId, quizId), exact: true }),
  });
}

export function useAttempt(roomId: string, quizId: string, attemptId: string | null) {
  return useQuery({
    queryKey: queryKeys.attempt(roomId, quizId, attemptId ?? ""),
    queryFn: () => learningApi.attempt(roomId, quizId, attemptId!),
    enabled: !!attemptId,
  });
}

export function useAnswer(roomId: string, quizId: string, attemptId: string) {
  return useMutation({
    mutationFn: ({ questionId, response }: { questionId: string; response: string }) =>
      learningApi.answer(roomId, quizId, attemptId, questionId, response),
  });
}

export function useCompleteAttempt(roomId: string, quizId: string, attemptId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => learningApi.completeAttempt(roomId, quizId, attemptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quiz(roomId, quizId), exact: true });
      queryClient.invalidateQueries({ queryKey: queryKeys.quizzes(roomId), exact: true });
      queryClient.invalidateQueries({ queryKey: queryKeys.progress(roomId), exact: true });
    },
  });
}

/* ----------------------------------------------------------------- studio */

export function useStudioItems(roomId: string) {
  return useQuery({ queryKey: queryKeys.studio(roomId), queryFn: () => learningApi.studioItems(roomId) });
}

export function useStudioItem(roomId: string, itemId: string) {
  return useQuery({ queryKey: queryKeys.studioItem(roomId, itemId), queryFn: () => learningApi.studioItem(roomId, itemId) });
}

export function useCreateStudioItem(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: StudioKind; materialIds: string[] }) => learningApi.createStudioItem(roomId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.studio(roomId), exact: true }),
  });
}

export function useDeleteStudioItem(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => learningApi.deleteStudioItem(roomId, itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.studio(roomId), exact: true }),
  });
}

/** Looks through the cards' files again from scratch (picks up newer reading, like AI labels). */
export function useRefreshStudioItem(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => learningApi.refreshStudioItem(roomId, itemId),
    onSuccess: (_, itemId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.studio(roomId), exact: true });
      queryClient.invalidateQueries({ queryKey: queryKeys.studioItem(roomId, itemId), exact: true });
    },
  });
}

export function useRetryStudioItem(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => learningApi.retryStudioItem(roomId, itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.studio(roomId), exact: true }),
  });
}

/* --------------------------------------------------------------- progress */

export function useProgress(roomId: string) {
  return useQuery({ queryKey: queryKeys.progress(roomId), queryFn: () => learningApi.progress(roomId) });
}

/* ------------------------------------------------------------------ tutor */

export function useConversations(roomId: string) {
  return useQuery({ queryKey: queryKeys.conversations(roomId), queryFn: () => learningApi.conversations(roomId) });
}

export function useConversation(roomId: string, conversationId: string | null) {
  return useQuery({
    queryKey: queryKeys.conversation(roomId, conversationId ?? ""),
    queryFn: () => learningApi.conversation(roomId, conversationId!),
    enabled: !!conversationId,
    staleTime: Infinity, // the chat hook owns messages once a conversation is open
  });
}

export function useCreateConversation(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => learningApi.createConversation(roomId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.conversations(roomId), exact: true }),
  });
}

export function useDeleteConversation(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => learningApi.deleteConversation(roomId, conversationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.conversations(roomId), exact: true }),
  });
}
