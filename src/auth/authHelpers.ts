import type { FieldErrors } from "../lib/api.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSWORD_LENGTH = 8;

/** Seconds to wait before another reset email can be requested. */
export const RESEND_COOLDOWN_SECONDS = 30;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The reset token from a `?token=…` query string, or null when it's missing or clearly not a token
 * (so we can show the "invalid link" page without asking the server).
 */
export function readResetToken(search: string): string | null {
  const token = new URLSearchParams(search).get("token")?.trim();
  if (!token || token.length < 16 || token.length > 512) return null;
  return /^[A-Za-z0-9._~-]+$/.test(token) ? token : null;
}

/** Checks for a new password and its confirmation, matching the server's signup rules. */
export function validateNewPassword(password: string, confirm: string, fields = { password: "password", confirm: "confirmPassword" }): FieldErrors {
  const errors: FieldErrors = {};
  if (password.length < MIN_PASSWORD_LENGTH) errors[fields.password] = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (confirm !== password) errors[fields.confirm] = "Passwords don't match";
  return errors;
}

/** Whole seconds left before the resend button unlocks (0 when it's ready). */
export function resendSecondsLeft(sentAt: number, now: number, cooldownSeconds = RESEND_COOLDOWN_SECONDS): number {
  return Math.max(0, Math.ceil((sentAt + cooldownSeconds * 1000 - now) / 1000));
}

/**
 * Where to go after signing in: the `from` path a guard or invite page put in the router state.
 * Only same-site paths are honoured, never `//evil.com` or full URLs.
 */
export function redirectTarget(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  if (typeof from !== "string" || !from.startsWith("/") || from.startsWith("//") || from.startsWith("/\\")) return "/";
  return from;
}

/** The login error the server gives a Google-only account that tries a password. */
export function isGoogleOnlyError(message: string | undefined): boolean {
  return !!message && /google/i.test(message);
}

/** Google's button takes a fixed pixel width between 200 and 400; fit it to its container. */
export function googleButtonWidth(containerWidth: number): number {
  return Math.round(Math.min(400, Math.max(200, containerWidth)));
}
