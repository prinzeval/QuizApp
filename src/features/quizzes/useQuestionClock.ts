import { useCallback, useEffect, useRef } from "react";
import { QuestionClock } from "./quizTime.ts";

const storageKey = (attemptId: string) => `smartquiz.questionTime.${attemptId}`;

function loadSaved(attemptId: string): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(storageKey(attemptId));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] >= 0));
  } catch {
    return {};
  }
}

/**
 * Times how long each question of an attempt is on screen, across visits
 * (paused while the tab is hidden; kept through a reload in this tab).
 * Returns `elapsed(questionId)` for sending with the answer.
 */
export function useQuestionClock(attemptId: string, questionId: string): (questionId: string) => number {
  const clockRef = useRef<QuestionClock | null>(null);
  clockRef.current ??= new QuestionClock(loadSaved(attemptId));
  const current = useRef(questionId);

  const save = useCallback(() => {
    try {
      sessionStorage.setItem(storageKey(attemptId), JSON.stringify(clockRef.current!.snapshot(Date.now())));
    } catch {
      /* storage blocked: times just restart after a reload */
    }
  }, [attemptId]);

  useEffect(() => {
    current.current = questionId;
    clockRef.current!.show(document.visibilityState === "visible" ? questionId : null, Date.now());
    save();
  }, [questionId, save]);

  useEffect(() => {
    const clock = clockRef.current!;
    const onVisibility = () => {
      clock.show(document.visibilityState === "visible" ? current.current : null, Date.now());
      save();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", save);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", save);
      clock.show(null, Date.now());
      save();
    };
  }, [save]);

  return useCallback((id: string) => clockRef.current!.elapsed(id, Date.now()), []);
}
