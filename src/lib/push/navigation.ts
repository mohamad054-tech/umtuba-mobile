import type * as Notifications from "expo-notifications";

import {
  deepLinkToHref,
  parseDeepLink,
} from "@/src/lib/linking/deepLinks";
import {
  parsePushPayload,
  resolvePushNavigationHref,
} from "@/src/lib/push/parsePayload";

function resolveAllowedDeepLinkHref(url: string): string | null {
  const parsed = parseDeepLink(url);
  if (parsed.target.type === "unknown") {
    return null;
  }
  return deepLinkToHref(parsed.target);
}

/**
 * Map a notification (foreground or tap) to an Expo Router href.
 * Falls back to /notifications when no safe route is present.
 */
export function notificationToHref(
  notification: Notifications.Notification
): string {
  const content = notification.request.content;
  const payload = parsePushPayload({
    title: content.title,
    body: content.body,
    data: content.data,
  });
  return (
    resolvePushNavigationHref(payload, {
      resolveUrl: resolveAllowedDeepLinkHref,
    }) ?? "/notifications"
  );
}

export function notificationResponseToHref(
  response: Notifications.NotificationResponse
): string {
  return notificationToHref(response.notification);
}
