/**
 * Generic push payload contract.
 * Categories are free-form strings so future product types can ship
 * without a mobile app release that hardcodes an enum.
 */
export type PushPlatform = "ios" | "android" | "unknown";

export type PushPermissionStatus =
  | "granted"
  | "denied"
  | "undetermined"
  | "unavailable";

export type ParsedPushPayload = {
  /** Opaque product category (e.g. message, reward) — never validated as an enum. */
  category: string | null;
  title: string | null;
  body: string | null;
  /** Preferred deep-link URL if present (umtuba://… or https://umtuba.com/…). */
  url: string | null;
  /** Relative path fallback (e.g. /messages/… or messages?conversation=…). */
  path: string | null;
  /** Remaining stringly data for future handlers. */
  data: Record<string, string>;
};

export type PushRegistrationResult =
  | {
      ok: true;
      token: string;
      platform: PushPlatform;
      permission: PushPermissionStatus;
      refreshed: boolean;
    }
  | {
      ok: false;
      reason:
        | "permission_denied"
        | "unavailable"
        | "not_device"
        | "no_project"
        | "error";
      permission: PushPermissionStatus;
      message: string;
    };

export const PUSH_TOKENS_TABLE = "push_tokens";
