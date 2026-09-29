import type { MantineColor } from "@mantine/core";
import type { Progress } from "../../lib/learningApi.ts";

/** Red under 50%, yellow under 70%, green from 70% (the backend's "weak" line). */
export function accuracyColor(accuracy: number): MantineColor {
  if (accuracy < 50) return "red";
  if (accuracy < 70) return "yellow";
  return "green";
}

export interface TrendPoint {
  week: string;
  weekStart: string;
  accuracy: number | null;
  answered: number;
}

const DAY = 24 * 3600 * 1000;

/** Monday 00:00 UTC of the week containing `date` (matches Postgres `date_trunc('week', …)` in UTC). */
export function weekStartUTC(date: Date): Date {
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const sinceMonday = (new Date(midnight).getUTCDay() + 6) % 7;
  return new Date(midnight - sinceMonday * DAY);
}

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

/**
 * The last `weeks` weeks, oldest first, with gaps for weeks without answers so
 * the x-axis reads as real time rather than just the weeks that had activity.
 */
export function fillTrend(trend: Progress["trend"], now = new Date(), weeks = 8): TrendPoint[] {
  const byWeek = new Map(trend.map(point => [dayKey(weekStartUTC(new Date(point.weekStart))), point]));
  const current = weekStartUTC(now).getTime();
  const label = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
  return Array.from({ length: weeks }, (_, index) => {
    const start = new Date(current - (weeks - 1 - index) * 7 * DAY);
    const point = byWeek.get(dayKey(start));
    return { week: label.format(start), weekStart: start.toISOString(), accuracy: point ? point.accuracy : null, answered: point?.answered ?? 0 };
  });
}
