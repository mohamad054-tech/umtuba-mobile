export const USERNAME_PATTERN = /^[a-z0-9._]{3,24}$/;
export const USERNAME_HINT =
  "Use 3–24 characters: lowercase letters, numbers, dots, or underscores.";

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(value));
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function validatePassword(password: string): string | null {
  if (!password) {
    return "Password is required.";
  }

  if (password.length < 6) {
    return "Password must be at least 6 characters.";
  }

  return null;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: unknown }).message).trim();

    if (message) {
      return message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function isUsernameTakenError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("username") &&
    (lower.includes("taken") ||
      lower.includes("duplicate") ||
      lower.includes("unique") ||
      lower.includes("already"))
  );
}
