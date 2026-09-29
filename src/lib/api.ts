const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:6969/api/v1";
const TOKEN_KEY = "smartquiz.token";

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }

  const body: unknown = await response.json().catch(() => null);

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

export const api = {
  signup: (input: { name: string; email: string; password: string }) =>
    request<AuthResponse>("/auth/signup", { method: "POST", body: JSON.stringify(input) }),
  login: (input: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(input) }),
  me: () => request<{ user: User }>("/app/profile"),
};
