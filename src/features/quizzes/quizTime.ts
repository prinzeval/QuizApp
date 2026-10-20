/** Timed exams: countdown text, durations, and how long each question was on screen. */

/** Under this much time left, the countdown turns to a warning colour. */
export const WARNING_MS = 2 * 60_000;
/** The server accepts up to an hour per question. */
export const MAX_QUESTION_MS = 3_600_000;
export const TIME_LIMIT = { min: 5, max: 180, default: 20, step: 5 } as const;

/** Milliseconds until an ISO deadline (negative once it has passed). */
export function remainingMs(deadlineAt: string, now: number): number {
  return new Date(deadlineAt).getTime() - now;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "19:59", "0:05:00" style countdown → "mm:ss", or "h:mm:ss" from an hour up. Rounds up so 0:00 means time's up. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** Spoken form for screen readers: "12 minutes 5 seconds left". */
export function countdownLabel(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts = [
    hours ? `${hours} ${hours === 1 ? "hour" : "hours"}` : "",
    minutes ? `${minutes} ${minutes === 1 ? "minute" : "minutes"}` : "",
    seconds || (!hours && !minutes) ? `${seconds} ${seconds === 1 ? "second" : "seconds"}` : "",
  ].filter(Boolean);
  return `${parts.join(" ")} left`;
}

/** A short duration: "45s", "1m 05s", "1h 02m". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  if (total < 60) return `${total}s`;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${pad(minutes)}m`;
  return `${minutes}m ${pad(total % 60)}s`;
}

/** "20 min exam", "2 h exam", "1 h 30 min exam". */
export function timeLimitLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min exam`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min exam` : `${hours} h exam`;
}

/** Sum of recorded times; null when no question has one (older attempts). */
export function totalTimeMs(reviews: { timeSpentMs?: number | null }[]): number | null {
  const recorded = reviews.map(r => r.timeSpentMs).filter((ms): ms is number => typeof ms === "number");
  return recorded.length ? recorded.reduce((sum, ms) => sum + ms, 0) : null;
}

/**
 * Adds up how long each question is on screen, across visits. `show` switches
 * to a question (or pauses with null, e.g. while the tab is hidden).
 */
export class QuestionClock {
  private readonly totals: Map<string, number>;
  private current: string | null = null;
  private since = 0;

  constructor(initial: Record<string, number> = {}) {
    this.totals = new Map(Object.entries(initial));
  }

  show(questionId: string | null, now: number): void {
    this.settle(now);
    this.current = questionId;
    this.since = now;
  }

  /** Time on a question so far, including the visit in progress; capped at the server's limit. */
  elapsed(questionId: string, now: number): number {
    const base = this.totals.get(questionId) ?? 0;
    const live = this.current === questionId ? Math.max(0, now - this.since) : 0;
    return Math.min(MAX_QUESTION_MS, Math.round(base + live));
  }

  /** Every question's time, for saving between page loads. */
  snapshot(now: number): Record<string, number> {
    this.settle(now);
    return Object.fromEntries(this.totals);
  }

  private settle(now: number): void {
    if (this.current === null) return;
    this.totals.set(this.current, (this.totals.get(this.current) ?? 0) + Math.max(0, now - this.since));
    this.since = now;
  }
}
