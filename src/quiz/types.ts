export interface Question {
  question: string;
  options: string[];
  /** Index into `options` of the correct answer. */
  answer: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  title: string;
  questions: Question[];
  createdAt: number;
  source: "ai" | "paste";
  /** Best score as a percentage, or null if never finished. */
  best: number | null;
}

export type Difficulty = "easy" | "medium" | "hard" | "brutal";
export type Mode = "practice" | "exam";
