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

const TECHNICAL_PATTERN =
  /\b(sql|supabase|postgres|stack|traceback|exception|enoent|econnrefused|typescript|\.ts\b|\.tsx\b|\.js\b|node_modules|process\.env|secret|jwt|authorization|rls|api[_-]?key|service[_-]?role|refresh.?token)\b|_KEY\b|SUPABASE_/i;

/**
 * Sanitize user-facing auth/API errors. Never surface SQL, stacks, or secrets.
 */
export function sanitizeUserFacingMessage(
  message: string | null | undefined,
  fallback: string
): string {
  const trimmed = (message ?? "").trim();
  if (!trimmed) {
    return fallback;
  }
  if (TECHNICAL_PATTERN.test(trimmed)) {
    return fallback;
  }
  if (trimmed.length > 180) {
    return fallback;
  }
  return trimmed;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  let raw = "";

  if (error && typeof error === "object" && "message" in error) {
    raw = String((error as { message: unknown }).message).trim();
  } else if (error instanceof Error && error.message.trim()) {
    raw = error.message.trim();
  }

  return sanitizeUserFacingMessage(raw, fallback);
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
