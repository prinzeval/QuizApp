import { describe, expect, it } from "vitest";
import {
  googleButtonWidth,
  isGoogleOnlyError,
  isValidEmail,
  normalizeEmail,
  readResetToken,
  redirectTarget,
  resendSecondsLeft,
  validateNewPassword,
} from "./authHelpers.ts";

const TOKEN = "a1B2c3D4e5F6g7H8i9J0_-k";

describe("isValidEmail / normalizeEmail", () => {
  it.each([
    ["nana@example.com", true],
    ["  nana@example.com ", true],
    ["nana@example", false],
    ["nana example.com", false],
    ["", false],
  ])("%s → %s", (email, valid) => {
    expect(isValidEmail(email)).toBe(valid);
  });

  it("trims and lowercases", () => {
    expect(normalizeEmail("  Nana@Example.COM ")).toBe("nana@example.com");
  });
});

describe("readResetToken", () => {
  it("reads a token from the query string", () => {
    expect(readResetToken(`?token=${TOKEN}`)).toBe(TOKEN);
    expect(readResetToken(`?foo=1&token=${TOKEN}`)).toBe(TOKEN);
  });

  it.each([[""], ["?token="], ["?token=short"], ["?token=has spaces in it okay"], [`?token=${"x".repeat(600)}`], ["?token=<script>alert(1)</script>"]])(
    "rejects %s",
    search => {
      expect(readResetToken(search)).toBeNull();
    },
  );
});

describe("validateNewPassword", () => {
  it("accepts a long enough, matching password", () => {
    expect(validateNewPassword("correct horse", "correct horse")).toEqual({});
  });

  it("flags short and mismatched passwords", () => {
    expect(validateNewPassword("short", "other")).toEqual({
      password: "Password must be at least 8 characters",
      confirmPassword: "Passwords don't match",
    });
  });

  it("uses the given field names", () => {
    expect(validateNewPassword("short", "short", { password: "newPassword", confirm: "confirm" })).toEqual({
      newPassword: "Password must be at least 8 characters",
    });
  });
});

describe("resendSecondsLeft", () => {
  it("counts down from 30 and stops at 0", () => {
    expect(resendSecondsLeft(0, 0)).toBe(30);
    expect(resendSecondsLeft(0, 100)).toBe(30);
    expect(resendSecondsLeft(0, 29_001)).toBe(1);
    expect(resendSecondsLeft(0, 30_000)).toBe(0);
    expect(resendSecondsLeft(0, 99_000)).toBe(0);
  });
});

describe("redirectTarget", () => {
  it("returns a same-site path from router state", () => {
    expect(redirectTarget({ from: "/invite/abc?x=1" })).toBe("/invite/abc?x=1");
  });

  it.each([[null], [undefined], [{}], [{ from: 42 }], [{ from: "https://evil.com" }], [{ from: "//evil.com" }], [{ from: "/\\evil.com" }]])(
    "falls back to / for %j",
    state => {
      expect(redirectTarget(state)).toBe("/");
    },
  );
});

describe("isGoogleOnlyError", () => {
  it("spots the Google-account login error", () => {
    expect(isGoogleOnlyError("This account uses Google sign-in. Continue with Google, or reset your password to set one.")).toBe(true);
    expect(isGoogleOnlyError("Incorrect password")).toBe(false);
    expect(isGoogleOnlyError(undefined)).toBe(false);
  });
});

describe("googleButtonWidth", () => {
  it("clamps to Google's 200–400px range", () => {
    expect(googleButtonWidth(0)).toBe(200);
    expect(googleButtonWidth(358.4)).toBe(358);
    expect(googleButtonWidth(900)).toBe(400);
  });
});
