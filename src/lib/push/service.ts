import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { requestNotificationsPermission } from "@/src/lib/permissions/foundation";
import {
  cachePushRegistration,
  clearCachedPushRegistration,
  getCachedPushToken,
  getCachedPushUserId,
} from "@/src/lib/push/tokenCache";
import {
  deletePushToken,
  upsertPushToken,
} from "@/src/lib/push/supabaseTokens";
import type {
  PushPermissionStatus,
  PushPlatform,
  PushRegistrationResult,
} from "@/src/lib/push/types";
import { getSupabase } from "@/src/lib/supabase/client";

let handlerConfigured = false;
let androidChannelReady = false;
let missingTableWarned = false;

function mapPermissionStatus(
  granted: boolean,
  canAskAgain: boolean,
  status?: Notifications.PermissionStatus
): PushPermissionStatus {
  if (granted) return "granted";
  if (status === Notifications.PermissionStatus.DENIED || !canAskAgain) {
    return "denied";
  }
  if (status === Notifications.PermissionStatus.UNDETERMINED) {
    return "undetermined";
  }
  return canAskAgain ? "undetermined" : "denied";
}

export function getPushPlatform(): PushPlatform {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "unknown";
}

function resolveEasProjectId(): string | null {
  const fromEas =
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    null;
  if (typeof fromEas === "string" && fromEas.trim() && !fromEas.includes("placeholder")) {
    return fromEas.trim();
  }
  return null;
}

/** Foreground presentation defaults — safe for Android + iOS. */
export function configurePushNotificationHandler(): void {
  if (handlerConfigured || Platform.OS === "web") return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  handlerConfigured = true;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android" || androidChannelReady) return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "UMTUBA",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#050510",
  });
  androidChannelReady = true;
}

/**
 * Request notification permission with a clear UX path:
 * - already granted / provisional → continue (no re-prompt)
 * - undetermined → system prompt once
 * - denied / cannot ask again → report denied (no re-prompt loop)
 */
export async function ensurePushPermission(): Promise<{
  granted: boolean;
  status: PushPermissionStatus;
  canAskAgain: boolean;
  explanation: string;
}> {
  if (Platform.OS === "web") {
    return {
      granted: false,
      status: "unavailable",
      canAskAgain: false,
      explanation: "Push notifications are not available on web.",
    };
  }

  const current = await Notifications.getPermissionsAsync();
  const provisional =
    current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (current.granted || provisional) {
    return {
      granted: true,
      status: "granted",
      canAskAgain: current.canAskAgain,
      explanation: "Notifications are enabled.",
    };
  }

  if (
    current.status === Notifications.PermissionStatus.DENIED ||
    current.canAskAgain === false
  ) {
    return {
      granted: false,
      status: "denied",
      canAskAgain: current.canAskAgain,
      explanation:
        "Notifications are turned off. You can enable them in system Settings.",
    };
  }

  // Undetermined only — avoids re-prompting on every resume/register.
  const outcome = await requestNotificationsPermission();
  const after = await Notifications.getPermissionsAsync();
  return {
    granted: outcome.granted,
    status: mapPermissionStatus(
      outcome.granted,
      outcome.canAskAgain,
      after.status
    ),
    canAskAgain: outcome.canAskAgain,
    explanation: outcome.explanation,
  };
}

async function fetchExpoPushToken(): Promise<
  { ok: true; token: string } | { ok: false; reason: "no_project" | "error"; message: string }
> {
  const projectId = resolveEasProjectId();
  if (!projectId) {
    return {
      ok: false,
      reason: "no_project",
      message: "Missing EAS projectId for Expo push tokens.",
    };
  }
  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = result.data?.trim();
    if (!token) {
      return { ok: false, reason: "error", message: "Empty Expo push token." };
    }
    return { ok: true, token };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      message:
        err instanceof Error ? err.message : "Unable to fetch Expo push token.",
    };
  }
}

/**
 * Register or refresh the Expo push token for the signed-in user.
 * Handles first install, refresh, and permission denial/revocation.
 */
export async function registerPushForUser(
  userId: string
): Promise<PushRegistrationResult> {
  if (Platform.OS === "web") {
    return {
      ok: false,
      reason: "unavailable",
      permission: "unavailable",
      message: "Push notifications are not available on web.",
    };
  }

  if (!Device.isDevice) {
    return {
      ok: false,
      reason: "not_device",
      permission: "unavailable",
      message: "Push tokens require a physical device.",
    };
  }

  await ensureAndroidChannel();
  const permission = await ensurePushPermission();
  if (!permission.granted) {
    // Permission revoked/denied — drop remote+local registration if we had one.
    await unregisterPushForUser(userId, { clearEvenIfRemoteFails: true });
    return {
      ok: false,
      reason: "permission_denied",
      permission: permission.status,
      message: permission.explanation,
    };
  }

  const tokenResult = await fetchExpoPushToken();
  if (!tokenResult.ok) {
    return {
      ok: false,
      reason: tokenResult.reason,
      permission: permission.status,
      message: tokenResult.message,
    };
  }

  const previous = await getCachedPushToken();
  const refreshed = Boolean(previous && previous !== tokenResult.token);
  const platform = getPushPlatform();

  try {
    const supabase = getSupabase();
    if (previous && previous !== tokenResult.token) {
      await deletePushToken(supabase, { userId, token: previous });
    }
    const saved = await upsertPushToken(supabase, {
      user_id: userId,
      token: tokenResult.token,
      platform,
      device_id: Device.modelId ?? Device.osInternalBuildId ?? null,
    });
    if (!saved.ok) {
      if (saved.missingTable) {
        if (!missingTableWarned) {
          missingTableWarned = true;
          console.warn(
            "push_tokens table not provisioned yet — caching token locally only."
          );
        }
      } else {
        console.warn("push token upsert failed:", saved.message);
      }
    }
  } catch (err) {
    console.warn("push token sync error:", err);
  }

  await cachePushRegistration(userId, tokenResult.token);

  return {
    ok: true,
    token: tokenResult.token,
    platform,
    permission: permission.status,
    refreshed,
  };
}

/**
 * Remove the current device token from Supabase (authenticated) and local cache.
 * Call while the user session is still valid (e.g. during signOut).
 */
export async function unregisterPushForUser(
  userId: string,
  opts?: { clearEvenIfRemoteFails?: boolean }
): Promise<void> {
  const token = await getCachedPushToken();
  const cachedUser = await getCachedPushUserId();
  const ownerId = userId || cachedUser;

  if (token && ownerId) {
    try {
      const supabase = getSupabase();
      const removed = await deletePushToken(supabase, {
        userId: ownerId,
        token,
      });
      if (!removed.ok && !removed.missingTable) {
        console.warn("push token delete failed:", removed.message);
        if (!opts?.clearEvenIfRemoteFails) {
          // Still clear local so a revoked permission does not keep stale state.
        }
      }
    } catch (err) {
      console.warn("push token delete error:", err);
    }
  }

  await clearCachedPushRegistration();
}

/** Convenience for logout: uses cached user id when the caller still has session user. */
export async function unregisterPushOnLogout(userId: string | null): Promise<void> {
  const cachedUser = userId ?? (await getCachedPushUserId());
  if (!cachedUser) {
    await clearCachedPushRegistration();
    return;
  }
  await unregisterPushForUser(cachedUser, { clearEvenIfRemoteFails: true });
}
