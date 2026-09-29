// Turns loosely formatted multiple-choice text (usually pasted from ChatGPT)
// into quiz questions. Tolerates markdown, "A)" / "A." / "(A)" options,
// questions spanning several lines, and answers given as a letter or as text.

import type { Question } from "./types.ts";

export const LETTERS = "ABCDEFGH";

interface Draft extends Question {
  numbered: boolean;
}

export interface ParseResult {
  questions: Question[];
  problems: string[];
}

const QUESTION_RE = /^(?:q(?:uestion)?\s*)?(\d{1,4})\s*[.):\-]\s*(.*)$/i;
const OPTION_RE = /^[([]?([a-h])\s*[).:\]]\s*(.+)$/i;
const ANSWER_RE = /^(?:correct\s+)?(?:answer|ans|solution)\s*(?:is)?\s*[:\-–=]\s*(.+)$/i;
const EXPLANATION_RE = /^(?:explanation|reason|why)\s*[:\-–]\s*(.+)$/i;

function clean(line: string): string {
  return line
    .replace(/\*\*|__|`/g, "")
    .replace(/^#+\s*/, "")
    .replace(/^[-•]\s+(?=[([]?[a-h]\s*[).:\]])/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveAnswer(raw: string, options: string[]): number {
  const text = raw.trim();
  const letter = text.match(/^[([]?([a-h])(?:[).:\]\s]|$)/i);
  if (letter) {
    const index = LETTERS.indexOf(letter[1].toUpperCase());
    if (index < options.length) return index;
  }
  const needle = text.replace(/^[([]?[a-h][).:\]]\s*/i, "").toLowerCase().replace(/[.\s]+$/, "");
  return options.findIndex(o => o.toLowerCase().replace(/[.\s]+$/, "") === needle);
}

export function parseQuiz(text: string): ParseResult {
  const questions: Question[] = [];
  const problems: string[] = [];
  // Cast (not an annotation) so TS doesn't narrow this to `null`: finish/start reassign it.
  let current = null as Draft | null;

  const finish = (): void => {
    if (!current) return;
    const label = current.question.slice(0, 60) || "(untitled)";
    const chatter = current.options.length === 0 && !current.numbered; // e.g. "Here are your questions:"
    if (current.options.length >= 2 && current.answer >= 0) {
      const { numbered: _numbered, ...question } = current;
      questions.push(question);
    } else if (current.options.length < 2 && !chatter) problems.push(`"${label}" has fewer than two options`);
    else if (!chatter) problems.push(`"${label}" has no answer I could match`);
    current = null;
  };

  const start = (question: string, numbered = false): void => {
    finish();
    current = { question, options: [], answer: -1, explanation: "", numbered };
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = clean(rawLine);
    if (!line) continue;

    const answer = line.match(ANSWER_RE);
    if (answer && current) {
      current.answer = resolveAnswer(answer[1], current.options);
      continue;
    }

    const explanation = line.match(EXPLANATION_RE);
    if (explanation && current) {
      current.explanation = explanation[1];
      continue;
    }

    // Only accept an option when its letter is the next one expected, so
    // prose that happens to start with "A." isn't mistaken for an option.
    const option = line.match(OPTION_RE);
    if (option && current && LETTERS.indexOf(option[1].toUpperCase()) === current.options.length) {
      current.options.push(option[2].trim());
      continue;
    }

    const numbered = line.match(QUESTION_RE);
    if (numbered) {
      start(numbered[2], true);
      continue;
    }

    if (current && current.options.length === 0) {
      current.question = `${current.question} ${line}`.trim();
    } else if (!current || current.answer >= 0) {
      // Unnumbered question after a finished one; lines before any question
      // (e.g. "Here are your questions:") only count if options follow.
      start(line);
    }
  }
  finish();

  return { questions, problems };
}
