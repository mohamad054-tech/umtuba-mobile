import { describe, expect, it } from "vitest";

import {
  getErrorMessage,
  isValidEmail,
  isValidUsername,
  normalizeUsername,
  validatePassword,
} from "./validation";

describe("normalizeUsername / isValidUsername", () => {
  it("strips @ and lowercases", () => {
    expect(normalizeUsername("@Alice.Bob")).toBe("alice.bob");
    expect(isValidUsername("@ok_user")).toBe(true);
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("Bad Name")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("validates basic emails", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
  });
});

describe("validatePassword", () => {
  it("requires min length", () => {
    expect(validatePassword("")).toMatch(/required/i);
    expect(validatePassword("12345")).toMatch(/6/);
    expect(validatePassword("123456")).toBeNull();
  });
});

describe("getErrorMessage", () => {
  it("reads message from objects and Errors", () => {
    expect(getErrorMessage({ message: " boom " }, "fallback")).toBe("boom");
    expect(getErrorMessage(new Error("x"), "fallback")).toBe("x");
    expect(getErrorMessage(null, "fallback")).toBe("fallback");
  });
});
