import type { Difficulty, QuestionPending, QuestionReview, QuestionType, QuizAttempt, QuizMode, RequestableType } from "../../lib/learningApi.ts";

export const QUESTION_TYPES: RequestableType[] = ["multiple_choice", "true_false", "fill_blank", "picture"];
/** Picture questions are opt-in: the first time, the AI looks through every page for figures. */
export const DEFAULT_TYPES: RequestableType[] = ["multiple_choice", "true_false", "fill_blank"];
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
export const COUNT_LIMITS = { min: 3, max: 30 } as const;

export const TYPE_LABEL: Record<QuestionType | RequestableType, string> = {
  multiple_choice: "Multiple choice",
  true_false: "True / false",
  fill_blank: "Fill in the blank",
  picture: "Pictures",
  label_image: "Label the picture",
  locate_image: "Find it on the picture",
};

export const isPictureType = (type: QuestionType) => type === "label_image" || type === "locate_image";

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };
export const DIFFICULTY_COLOR: Record<Difficulty, string> = { easy: "teal", medium: "yellow", hard: "red" };
export const MODE_LABEL: Record<QuizMode, string> = { practice: "Practice", exam: "Exam" };

export const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

/** Whole-number percentage, 0 when there's nothing to score. */
export function percent(correct: number, total: number): number {
  return total > 0 ? Math.round((100 * correct) / total) : 0;
}

export function attemptPercent(attempt: Pick<QuizAttempt, "correctCount" | "totalCount">): number {
  return percent(attempt.correctCount ?? 0, attempt.totalCount ?? 0);
}

/** Colour for a score: green when strong, amber in the middle, red when low. */
export function scoreColor(value: number): string {
  if (value >= 80) return "teal";
  if (value >= 50) return "yellow";
  return "red";
}

/** A short, honest, encouraging line for the results screen. */
export function scoreMessage(value: number): { title: string; body: string } {
  if (value === 100) return { title: "Perfect score", body: "Every single one. You've got this material down." };
  if (value >= 80) return { title: "Excellent work", body: "You clearly know this. Skim the ones you missed and you're set." };
  if (value >= 60) return { title: "Good effort", body: "Solid foundations. A quick look at the explanations will close the gaps." };
  if (value >= 40) return { title: "Getting there", body: "Review the answers below, then give it another go. It sticks faster the second time." };
  return { title: "Keep going", body: "Every attempt builds memory. Read through the explanations and try again." };
}

/**
 * Splits a fill-in-the-blank prompt around its blank ("____").
 * Without a blank, the whole prompt comes back as `before`.
 */
export function splitBlank(prompt: string): { before: string; after: string; hasBlank: boolean } {
  const match = /_{2,}/.exec(prompt);
  if (!match) return { before: prompt, after: "", hasBlank: false };
  return { before: prompt.slice(0, match.index), after: prompt.slice(match.index + match[0].length), hasBlank: true };
}

/** Human text for a stored response ("2" → the option's text for choice questions). */
export function responseText(question: { type: QuestionType; options: string[] | null }, response: string | null): string | null {
  if (response === null || response === "") return null;
  if (question.type === "fill_blank") return response;
  if (question.type === "label_image") return "Your labels are shown on the picture";
  if (question.type === "locate_image") return "Your tap is shown on the picture";
  const option = question.options?.[Number(response)];
  return option ?? response;
}

/** The correct answer as text, plus any other accepted spellings for fill-in-the-blank. */
export function correctText(
  review: Pick<QuestionReview, "type" | "options" | "correctIndex" | "acceptedAnswers"> & { figure?: QuestionReview["figure"] },
): { answer: string; alsoAccepted: string[] } {
  if (review.type === "label_image") return { answer: "shown on the picture", alsoAccepted: [] };
  if (review.type === "locate_image") {
    const label = review.figure?.labels[review.correctIndex ?? -1]?.text;
    return { answer: label ? `${label}, highlighted on the picture` : "highlighted on the picture", alsoAccepted: [] };
  }
  if (review.type === "fill_blank") {
    const [answer = "", ...rest] = review.acceptedAnswers ?? [];
    return { answer, alsoAccepted: rest };
  }
  return { answer: review.options?.[review.correctIndex ?? -1] ?? "", alsoAccepted: [] };
}

export const isReview = (question: QuestionReview | QuestionPending): question is QuestionReview => "prompt" in question;

/** Per-topic tally of a finished attempt, weakest topics first. */
export function topicBreakdown(reviews: Pick<QuestionReview, "topic" | "isCorrect">[]): { topic: string; correct: number; total: number }[] {
  const byTopic = new Map<string, { topic: string; correct: number; total: number }>();
  for (const { topic, isCorrect } of reviews) {
    const name = topic.trim() || "General";
    const entry = byTopic.get(name) ?? { topic: name, correct: 0, total: 0 };
    entry.total += 1;
    if (isCorrect) entry.correct += 1;
    byTopic.set(name, entry);
  }
  return [...byTopic.values()].sort((a, b) => a.correct / a.total - b.correct / b.total || b.total - a.total || a.topic.localeCompare(b.topic));
}

/** Unique topics in question order. */
export function uniqueTopics(questions: { topic: string | null }[]): string[] {
  return [...new Set(questions.map(q => (q.topic ?? "").trim()).filter(Boolean))];
}

/**
 * Maps a key press to an answer for choice questions: 1–9 / A–F pick an option,
 * T / F answer true/false. Returns the option index or null.
 */
export function keyToOption(key: string, type: QuestionType, optionCount: number): number | null {
  if (type === "fill_blank" || type === "label_image" || type === "locate_image") return null;
  const lower = key.toLowerCase();
  if (type === "true_false") {
    if (lower === "t") return 0;
    if (lower === "f") return 1;
  }
  if (/^[1-9]$/.test(key)) {
    const index = Number(key) - 1;
    return index < optionCount ? index : null;
  }
  if (type === "multiple_choice" && /^[a-f]$/.test(lower)) {
    const index = lower.charCodeAt(0) - 97;
    return index < optionCount ? index : null;
  }
  return null;
}
