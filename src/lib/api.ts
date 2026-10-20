export const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:6969/api/v1";

/** Origin of the API server, for the realtime socket (e.g. http://localhost:6969). */
export const API_ORIGIN = new URL(BASE_URL).origin;
const TOKEN_KEY = "smartquiz.token";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  /** False for accounts created with Google that never set a password. */
  hasPassword: boolean;
}

/** Field name → error message, from the API's `validationErrors`. */
export type FieldErrors = Partial<Record<string, string>>;

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldErrors;

  constructor(message: string, status: number, fieldErrors: FieldErrors = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage blocked: the session just won't survive a reload */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

interface ErrorBody {
  message?: string;
  validationErrors?: { path: (string | number)[]; message: string }[];
}

let unauthorizedHandler: (() => void) | null = null;

/** Called when a logged-in request comes back 401. Set by AuthProvider. */
export function onUnauthorized(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const headers = new Headers(init.headers);
  // FormData sets its own multipart boundary; everything else is JSON.
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }

  const body: unknown = await response.json().catch(() => null);

  // A saved token the server no longer accepts (expired, account deleted): end the session.
  if (response.status === 401 && token) unauthorizedHandler?.();

  if (!response.ok) {
    const { message, validationErrors = [] } = (body ?? {}) as ErrorBody;
    const fieldErrors: FieldErrors = {};
    for (const { path, message: fieldMessage } of validationErrors) {
      const field = String(path[0] ?? "form");
      fieldErrors[field] ??= fieldMessage;
    }
    throw new ApiError(message ?? "Something went wrong. Please try again.", response.status, fieldErrors);
  }

  return (body as { data: T }).data;
}

export interface AuthResponse {
  user: User;
  token: string;
}

/** Public auth settings: which sign-in options the server offers. */
export interface AuthConfig {
  googleClientId: string | null;
  emailEnabled: boolean;
}

export type RoomRole = "owner" | "member";

export interface Room {
  id: string;
  name: string;
  description: string;
  role: RoomRole;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  /** Chat messages since you last read the room's chat (not yours). */
  unreadCount?: number;
}

export interface RoomMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: RoomRole;
  joinedAt: string;
}

export interface RoomInput {
  name: string;
  description: string;
}

export const api = {
  signup: (input: { name: string; email: string; password: string }) =>
    request<AuthResponse>("/auth/signup", { method: "POST", body: JSON.stringify(input) }),
  login: (input: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(input) }),
  authConfig: () => request<AuthConfig>("/auth/config"),
  google: (credential: string) =>
    request<AuthResponse & { created: boolean }>("/auth/google", { method: "POST", body: JSON.stringify({ credential }) }),
  forgotPassword: (email: string) =>
    request<{ sent: boolean }>("/auth/password/forgot", { method: "POST", body: JSON.stringify({ email }) }),
  checkResetToken: (token: string) =>
    request<{ valid: boolean; email: string | null }>(`/auth/password/reset/${encodeURIComponent(token)}`),
  resetPassword: (input: { token: string; password: string }) =>
    request<AuthResponse>("/auth/password/reset", { method: "POST", body: JSON.stringify(input) }),
  me: () => request<{ user: User }>("/app/profile"),
  updateProfile: (input: { name: string }) =>
    request<{ user: User }>("/app/profile", { method: "PUT", body: JSON.stringify(input) }),
  uploadAvatar: (image: Blob, filename: string) => {
    const form = new FormData();
    form.append("avatar", image, filename);
    return request<{ user: User }>("/app/profile/avatar", { method: "PUT", body: form });
  },
  removeAvatar: () => request<{ user: User }>("/app/profile/avatar", { method: "DELETE" }),
  /** `currentPassword` is left out when a Google-only account sets its first password. */
  changePassword: (input: { currentPassword?: string; newPassword: string }) =>
    request<{ token: string }>("/app/profile/password", { method: "PUT", body: JSON.stringify(input) }),
  /** Password accounts confirm with their password; Google-only accounts type DELETE. */
  deleteAccount: (input: { password: string } | { confirm: "DELETE" }) =>
    request<{ user: { id: string } }>("/app/profile", { method: "DELETE", body: JSON.stringify(input) }),

  rooms: () => request<{ rooms: Room[] }>("/app/rooms?limit=100"),
  room: (roomId: string) => request<{ room: Room; members: RoomMember[] }>(`/app/rooms/${encodeURIComponent(roomId)}`),
  createRoom: (input: RoomInput) =>
    request<{ room: Room }>("/app/rooms", { method: "POST", body: JSON.stringify(input) }),
  updateRoom: (roomId: string, input: RoomInput) =>
    request<{ room: Omit<Room, "role" | "memberCount"> }>(`/app/rooms/${encodeURIComponent(roomId)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteRoom: (roomId: string) =>
    request<{ room: { id: string } }>(`/app/rooms/${encodeURIComponent(roomId)}`, { method: "DELETE" }),
};
