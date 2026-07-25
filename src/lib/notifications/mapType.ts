import type { NotificationUiCategory } from "@/src/lib/notifications/types";

const SOCIAL_TYPES = new Set([
  "follow",
  "post_like",
  "comment",
  "reply",
  "mention",
  "post_save",
  "post_share",
]);

const MESSAGE_TYPES = new Set(["direct_message"]);

const WATCH_TYPES = new Set([
  "live_started",
  "nearby_live_started",
  "post_reached_country",
  "post_trending_country",
  "post_milestone",
  "post_journey_summary",
]);

const LEARNING_TYPES = new Set([
  "learning_course_completed",
  "learning_announcement_posted",
  "learning_discussion_reply",
  "learning_qa_answered",
  "learning_live_session_scheduled",
  "learning_live_session_updated",
  "learning_live_session_cancelled",
]);

const GAMES_TYPES = new Set([
  "game_invite",
  "game_result",
  "games_hub_update",
]);

const SYSTEM_TYPES = new Set([
  "um_points_earned",
  "reward_milestone",
  "referral_reward",
  "ai_creator_insight",
]);

/**
 * Map a backend notification type to a stable UI category.
 * Unknown types fail soft into `system` (still renderable).
 */
export function mapNotificationUiCategory(
  type: string | null | undefined
): NotificationUiCategory {
  const key = (type || "").trim().toLowerCase();
  if (!key) return "system";
  if (SOCIAL_TYPES.has(key)) return "social";
  if (MESSAGE_TYPES.has(key)) return "messages";
  if (WATCH_TYPES.has(key)) return "watch";
  if (LEARNING_TYPES.has(key)) return "learning";
  if (GAMES_TYPES.has(key)) return "games";
  if (SYSTEM_TYPES.has(key)) return "system";
  if (key.startsWith("learning_")) return "learning";
  if (key.startsWith("game")) return "games";
  if (key.includes("message") || key.includes("dm")) return "messages";
  if (key.includes("live") || key.includes("watch") || key.includes("post_")) {
    return "watch";
  }
  if (
    key.includes("follow") ||
    key.includes("like") ||
    key.includes("comment") ||
    key.includes("mention")
  ) {
    return "social";
  }
  return "system";
}

export function notificationCategoryLabel(
  category: NotificationUiCategory
): string {
  switch (category) {
    case "social":
      return "Social";
    case "messages":
      return "Messages";
    case "watch":
      return "Watch";
    case "learning":
      return "Learning";
    case "games":
      return "Games";
    case "system":
    default:
      return "System";
  }
}
