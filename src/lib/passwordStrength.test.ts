import { describe, expect, it } from "vitest";
import { passwordStrength } from "./passwordStrength.ts";

describe("passwordStrength", () => {
  it.each([
    ["", 0],
    ["abc", 1],
    ["abcdefgh", 1],
    ["password123!", 1],
    ["aaaaaaaaaaaa", 1],
    ["abcdefgh12", 1],
    ["Abcdefgh1234", 3],
    ["correct horse battery staple", 3],
    ["Tr0ub4dor&3-horse-staple", 4],
  ])("%s → %i", (password, score) => {
    expect(passwordStrength(password).score).toBe(score);
  });
});
