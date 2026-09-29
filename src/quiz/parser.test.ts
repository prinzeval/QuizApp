import { describe, expect, it } from "vitest";
import { parseQuiz } from "./parser.ts";

describe("parseQuiz", () => {
  it("parses the classic A) format", () => {
    const { questions, problems } = parseQuiz(`
      1. What is the primary inorganic component of bone?

      A) Collagen
      B) Osteoid
      C) Calcium hydroxyapatite
      D) Sodium chloride
      E) Magnesium oxide
      Answer: C
    `);
    expect(problems).toEqual([]);
    expect(questions).toEqual([
      {
        question: "What is the primary inorganic component of bone?",
        options: ["Collagen", "Osteoid", "Calcium hydroxyapatite", "Sodium chloride", "Magnesium oxide"],
        answer: 2,
        explanation: "",
      },
    ]);
  });

  it("handles markdown, (A) / A. options, preamble and explanations", () => {
    const { questions, problems } = parseQuiz(`
Here are your questions:

**1. Which organ produces insulin?**
(A) Liver
(B) Pancreas
(C) Kidney
(D) Spleen
**Answer:** B
Explanation: Beta cells in the pancreas secrete insulin.

**Question 2:** What is 2 + 2?
a. 3
b. 4
c. 5
Correct answer: b) 4
    `);
    expect(problems).toEqual([]);
    expect(questions).toHaveLength(2);
    expect(questions[0]).toMatchObject({ question: "Which organ produces insulin?", answer: 1, explanation: "Beta cells in the pancreas secrete insulin." });
    expect(questions[1]).toMatchObject({ question: "What is 2 + 2?", options: ["3", "4", "5"], answer: 1 });
  });

  it("joins multi-line questions and matches answers given as text", () => {
    const { questions } = parseQuiz(`
1. A patient presents with fatigue and pallor.
Which lab value is most likely low?
A) Hemoglobin
B) Platelets
Answer: Hemoglobin
    `);
    expect(questions[0].question).toBe("A patient presents with fatigue and pallor. Which lab value is most likely low?");
    expect(questions[0].answer).toBe(0);
  });

  it("does not mistake prose starting with a letter for an option", () => {
    const { questions } = parseQuiz(`
1. Which vitamin is fat-soluble?
A) Vitamin C
B) Vitamin K
Answer: B
2. Pick the vowel.
A) B
B) A
Answer: B
    `);
    expect(questions.map(q => q.options)).toEqual([["Vitamin C", "Vitamin K"], ["B", "A"]]);
  });

  it("reports questions it cannot use", () => {
    const { questions, problems } = parseQuiz(`
1. Missing answer?
A) Yes
B) No
2. Only one option?
A) Lonely
Answer: A
    `);
    expect(questions).toEqual([]);
    expect(problems).toHaveLength(2);
  });
});
