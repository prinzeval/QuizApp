import { ApiError, BASE_URL, request, tokenStore, type FieldErrors, type RoomRole } from "./api.ts";

const room = (roomId: string) => `/app/rooms/${encodeURIComponent(roomId)}`;
const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

/* ------------------------------------------------------------------ types */

export type MaterialKind = "pdf" | "docx" | "pptx" | "image" | "text";
export type MaterialStatus = "queued" | "processing" | "ready" | "failed";

export interface Material {
  id: string;
  roomId: string;
  title: string;
  kind: MaterialKind;
  mimeType: string;
  sizeBytes: number;
  status: MaterialStatus;
  error: string | null;
  /** Pages (or slides) in the file; known once reading starts. */
  pageCount: number | null;
  /** Pages read so far; ticks up live while `status` is "processing". */
  pagesRead: number;
  charCount: number | null;
  usedVision: boolean;
  /** Whole pages the AI read (PDF pages, a photo). */
  visionPages: number;
  /** Pictures and diagrams inside DOCX/PPTX files the AI described. */
  visionFigures: number;
  /** A calm heads-up about how the file was read (e.g. some figures couldn't be read). */
  notice: string | null;
  uploadedBy: string | null;
  uploaderName: string | null;
  createdAt: string;
  processedAt: string | null;
  chunkCount: number;
}

export interface MaterialChunk {
  id: string;
  chunkIndex: number;
  location: string | null;
  content: string;
}

export interface Invite {
  id: string;
  tokenPrefix: string;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  createdAt: string;
  createdByName?: string | null;
}

export type InviteStatus = "valid" | "expired" | "revoked" | "used_up";

export interface InvitePreview {
  status: InviteStatus;
  expiresAt: string | null;
  room: { id: string; name: string; description: string; memberCount: number };
  invitedBy: { name: string; avatarUrl: string | null } | null;
}

export type QuestionType = "multiple_choice" | "true_false" | "fill_blank";
export type Difficulty = "easy" | "medium" | "hard";
export type QuizMode = "practice" | "exam";
export type QuizStatus = "generating" | "ready" | "failed";

export interface QuizSummary {
  id: string;
  roomId: string;
  title: string;
  status: QuizStatus;
  difficulty: Difficulty;
  requestedCount: number;
  questionTypes: QuestionType[];
  focus: string | null;
  error: string | null;
  createdBy: string | null;
  creatorName: string | null;
  createdAt: string;
  questionCount: number;
  materials: { id: string; title: string }[];
  myCompletedAttempts: number;
  myBestScore: number | null;
}

/** A question as served for taking a quiz: no answers. */
export interface QuizQuestion {
  id: string;
  position: number;
  type: QuestionType;
  prompt: string;
  options: string[] | null;
  topic: string;
}

export interface QuizAttempt {
  id: string;
  mode: QuizMode;
  startedAt: string;
  completedAt: string | null;
  correctCount: number | null;
  totalCount: number | null;
}

export interface QuestionSource {
  materialId: string;
  materialTitle: string | null;
  location: string | null;
  excerpt: string | null;
}

/** A question with its answer revealed (practice feedback or finished attempt). */
export interface QuestionReview extends QuizQuestion {
  correctIndex: number | null;
  acceptedAnswers: string[] | null;
  explanation: string;
  response: string | null;
  isCorrect: boolean | null;
  source: QuestionSource | null;
}

/** Unrevealed progress on a question in an unfinished exam. */
export interface QuestionPending {
  id: string;
  position: number;
  response: string | null;
}

export interface NewQuizInput {
  title?: string;
  materialIds: string[];
  questionCount: number;
  difficulty: Difficulty;
  questionTypes: QuestionType[];
  focus?: string;
}

export interface Progress {
  totals: { answered: number; correct: number; accuracy: number; completedAttempts: number; quizzesTried: number };
  topics: { topic: string; answered: number; correct: number; accuracy: number; lastAnsweredAt: string }[];
  weakTopics: string[];
  trend: { weekStart: string; answered: number; accuracy: number }[];
  recentAttempts: { id: string; quizId: string; quizTitle: string; mode: QuizMode; correctCount: number; totalCount: number; completedAt: string }[];
}

export interface TutorSource {
  tag: string;
  chunkId: string;
  materialId: string;
  materialTitle: string;
  location: string | null;
  excerpt: string;
}

export interface TutorConversation {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Stored UI messages (AI SDK UIMessage shape) for a conversation. */
export interface StoredTutorMessage {
  id: string;
  role: "user" | "assistant";
  parts: Array<{ type: string; text?: string; data?: unknown }>;
}

export interface PresenceUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/* ------------------------------------------------------------------ calls */

/**
 * Uploads files with a progress callback (fetch can't report upload progress,
 * so this uses XMLHttpRequest). Resolves with the created materials.
 */
export function uploadMaterials(roomId: string, files: File[], onProgress?: (fraction: number) => void): Promise<{ materials: Material[] }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    files.forEach(file => form.append("files", file, file.name));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE_URL}${room(roomId)}/materials`);
    const token = tokenStore.get();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = event => event.lengthComputable && onProgress?.(event.loaded / event.total);
    xhr.onerror = () => reject(new ApiError("Upload failed. Check your connection and try again.", 0));
    xhr.onload = () => {
      let body: { data?: { materials: Material[] }; message?: string; validationErrors?: { path: (string | number)[]; message: string }[] } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON error page */
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.data) return resolve(body.data);
      const fieldErrors: FieldErrors = {};
      (body.validationErrors ?? []).forEach(({ path, message }) => (fieldErrors[String(path[0] ?? "form")] ??= message));
      const message = body.validationErrors?.[0]?.message ?? body.message ?? "Upload failed.";
      reject(new ApiError(message, xhr.status, fieldErrors));
    };
    xhr.send(form);
  });
}

/** Downloads a material's original file (auth needed, so not a plain link). Cache it with `useMaterialFile`. */
export async function fetchMaterialFile(roomId: string, materialId: string): Promise<Blob> {
  const response = await fetch(`${BASE_URL}${room(roomId)}/materials/${materialId}/file`, {
    headers: { Authorization: `Bearer ${tokenStore.get() ?? ""}` },
  });
  if (!response.ok) throw new ApiError(response.status === 404 ? "This file isn't available any more." : "Couldn't open this file.", response.status);
  return response.blob();
}

export const learningApi = {
  // materials
  materials: (roomId: string) => request<{ materials: Material[] }>(`${room(roomId)}/materials`),
  material: (roomId: string, materialId: string) =>
    request<{ material: Material; chunks: MaterialChunk[] }>(`${room(roomId)}/materials/${materialId}`),
  deleteMaterial: (roomId: string, materialId: string) => request<unknown>(`${room(roomId)}/materials/${materialId}`, json("DELETE")),
  retryMaterial: (roomId: string, materialId: string) =>
    request<{ material: Material }>(`${room(roomId)}/materials/${materialId}/retry`, json("POST")),

  // invites & members
  invites: (roomId: string) => request<{ invites: Invite[] }>(`${room(roomId)}/invites`),
  createInvite: (roomId: string, input: { expiresInDays: 1 | 7 | 30 | null; maxUses: number | null }) =>
    request<{ invite: Invite; token: string }>(`${room(roomId)}/invites`, json("POST", input)),
  revokeInvite: (roomId: string, inviteId: string) => request<unknown>(`${room(roomId)}/invites/${inviteId}`, json("DELETE")),
  invitePreview: (token: string) => request<{ invite: InvitePreview }>(`/auth/invites/${encodeURIComponent(token)}`),
  acceptInvite: (token: string) =>
    request<{ roomId: string; alreadyMember: boolean }>(`/app/invites/${encodeURIComponent(token)}/accept`, json("POST")),
  removeMember: (roomId: string, userId: string) => request<unknown>(`${room(roomId)}/members/${userId}`, json("DELETE")),
  leaveRoom: (roomId: string) => request<unknown>(`${room(roomId)}/membership`, json("DELETE")),

  // quizzes
  quizzes: (roomId: string) => request<{ quizzes: QuizSummary[] }>(`${room(roomId)}/quizzes`),
  quiz: (roomId: string, quizId: string) =>
    request<{ quiz: QuizSummary; questions: QuizQuestion[]; attempts: QuizAttempt[] }>(`${room(roomId)}/quizzes/${quizId}`),
  createQuiz: (roomId: string, input: NewQuizInput) => request<{ quiz: QuizSummary }>(`${room(roomId)}/quizzes`, json("POST", input)),
  deleteQuiz: (roomId: string, quizId: string) => request<unknown>(`${room(roomId)}/quizzes/${quizId}`, json("DELETE")),
  retryQuiz: (roomId: string, quizId: string) => request<{ quiz: QuizSummary }>(`${room(roomId)}/quizzes/${quizId}/retry`, json("POST")),
  startAttempt: (roomId: string, quizId: string, mode: QuizMode) =>
    request<{ attempt: QuizAttempt }>(`${room(roomId)}/quizzes/${quizId}/attempts`, json("POST", { mode })),
  attempt: (roomId: string, quizId: string, attemptId: string) =>
    request<{ attempt: QuizAttempt; questions: Array<QuestionReview | QuestionPending> }>(`${room(roomId)}/quizzes/${quizId}/attempts/${attemptId}`),
  answer: (roomId: string, quizId: string, attemptId: string, questionId: string, response: string) =>
    request<{ questionId: string; recorded: true; review?: QuestionReview }>(
      `${room(roomId)}/quizzes/${quizId}/attempts/${attemptId}/answers/${questionId}`,
      json("PUT", { response }),
    ),
  completeAttempt: (roomId: string, quizId: string, attemptId: string) =>
    request<{ attempt: QuizAttempt; questions: QuestionReview[] }>(`${room(roomId)}/quizzes/${quizId}/attempts/${attemptId}/complete`, json("POST")),

  // progress
  progress: (roomId: string) => request<Progress>(`${room(roomId)}/progress`),

  // tutor
  conversations: (roomId: string) => request<{ conversations: TutorConversation[] }>(`${room(roomId)}/tutor/conversations`),
  createConversation: (roomId: string) => request<{ conversation: TutorConversation }>(`${room(roomId)}/tutor/conversations`, json("POST")),
  conversation: (roomId: string, conversationId: string) =>
    request<{ conversation: TutorConversation; messages: StoredTutorMessage[] }>(`${room(roomId)}/tutor/conversations/${conversationId}`),
  deleteConversation: (roomId: string, conversationId: string) =>
    request<unknown>(`${room(roomId)}/tutor/conversations/${conversationId}`, json("DELETE")),
  /** Streaming endpoint used by the AI SDK chat transport. */
  chatUrl: (roomId: string, conversationId: string) => `${BASE_URL}${room(roomId)}/tutor/conversations/${conversationId}/chat`,
};

export type { RoomRole };
