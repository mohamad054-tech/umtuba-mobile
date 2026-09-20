export const ANALYTICS_EVENTS = {
  app_opened: "app_opened",
  sign_up_started: "sign_up_started",
  sign_up_completed: "sign_up_completed",
  login: "login",
  video_view: "video_view",
  video_like: "video_like",
  video_share: "video_share",
  comment_posted: "comment_posted",
  post_published: "post_published",
  search_performed: "search_performed",
  report_submitted: "report_submitted",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export type AnalyticsSurface =
  | "watch"
  | "discover"
  | "profile"
  | "create"
  | "world"
  | "messages"
  | "other";

export type AnalyticsEventProps = {
  app_opened: { platform: "android" | "ios" | "web" | "unknown" };
  sign_up_started: { surface: AnalyticsSurface };
  sign_up_completed: Record<string, never>;
  login: Record<string, never>;
  video_view: { post_id: number; surface: AnalyticsSurface };
  video_like: { post_id: number };
  video_share: { post_id: number };
  comment_posted: { post_id: number };
  post_published: { post_id: number };
  search_performed: { surface: AnalyticsSurface };
  report_submitted: { kind: "post" | "user" };
};

const FORBIDDEN_PROP_KEYS = [
  "email",
  "name",
  "full_name",
  "fullName",
  "phone",
  "query",
  "q",
  "text",
  "body",
  "caption",
  "message",
] as const;

export function assertSafeAnalyticsProps(
  props: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!props) return undefined;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if ((FORBIDDEN_PROP_KEYS as readonly string[]).includes(key)) continue;
    if (typeof value === "string" && value.includes("@")) continue;
    next[key] = value;
  }
  return next;
}

export function captureAnalyticsEvent<E extends AnalyticsEventName>(
  name: E,
  props: AnalyticsEventProps[E],
  sink?: (event: AnalyticsEventName, properties?: Record<string, unknown>) => void
): { event: E; properties: Record<string, unknown> | undefined } {
  const properties = assertSafeAnalyticsProps(
    props as Record<string, unknown>
  );
  sink?.(name, properties);
  return { event: name, properties };
}
