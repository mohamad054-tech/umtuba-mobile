import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/lib/auth/AuthContext";
import { notificationResponseToHref } from "@/src/lib/push/navigation";
import {
  configurePushNotificationHandler,
  registerPushForUser,
} from "@/src/lib/push/service";

/**
 * Wires Expo Notifications into auth + Expo Router:
 * - configures foreground handler
 * - registers/refreshes token when a user session is active
 * - routes notification taps (cold start + warm)
 * - refreshes registration when app returns to foreground
 *
 * Logout token removal is handled in AuthContext.signOut (while session is valid).
 */
export function PushNotificationsBridge() {
  const router = useRouter();
  const { user, loading, passwordRecoveryPending } = useAuth();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const handledResponseIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    configurePushNotificationHandler();
  }, []);

  useEffect(() => {
    if (loading || passwordRecoveryPending || Platform.OS === "web") return;
    if (!user?.id) return;
    void registerPushForUser(user.id);
  }, [loading, passwordRecoveryPending, user?.id]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const navigateFromResponse = (
      response: Notifications.NotificationResponse | null
    ) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handledResponseIds.current.has(id)) return;
      handledResponseIds.current.add(id);
      const href = notificationResponseToHref(response);
      router.push(href as never);
    };

    void Notifications.getLastNotificationResponseAsync().then(
      navigateFromResponse
    );

    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      // Foreground delivery is handled by setNotificationHandler presentation.
      // Future: badge / in-app toast can hook here without category hardcoding.
    });

    const responseSub =
      Notifications.addNotificationResponseReceivedListener(navigateFromResponse);

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [router]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const onChange = (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (
        (prev === "background" || prev === "inactive") &&
        next === "active" &&
        user?.id &&
        !passwordRecoveryPending
      ) {
        void registerPushForUser(user.id);
      }
    };

    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [passwordRecoveryPending, user?.id]);

  return null;
}
