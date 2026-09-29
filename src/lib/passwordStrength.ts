export interface Strength {
  /** 0 (empty) to 4 (strong). */
  score: 0 | 1 | 2 | 3 | 4;
  label: "" | "Too short" | "Weak" | "Okay" | "Good" | "Strong";
}

/** A rough guide for the meter under "New password". The server only enforces 8+ characters. */
export function passwordStrength(password: string): Strength {
  if (!password) return { score: 0, label: "" };
  if (password.length < 8) return { score: 1, label: "Too short" };

  let points = 0;
  if (password.length >= 12) points++;
  if (password.length >= 16) points++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points++;
  if (/\d/.test(password)) points++;
  if (/[^A-Za-z0-9]/.test(password)) points++;
  if (/^(.)\1+$/.test(password) || /^(?:password|12345678|qwerty)/i.test(password)) points = 0;

  if (points <= 1) return { score: 1, label: "Weak" };
  if (points === 2) return { score: 2, label: "Okay" };
  if (points === 3) return { score: 3, label: "Good" };
  return { score: 4, label: "Strong" };
}
