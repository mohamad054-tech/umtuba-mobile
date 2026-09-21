import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { Alert, AppState, Platform, type AppStateStatus } from "react-native";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/lib/auth/AuthContext";
import { useTranslation } from "@/src/lib/i18n";
import { notificationResponseToHref } from "@/src/lib/push/navigation";
import {
  pushFriendlyAskStorageKey,
  shouldExplainPushPermission,
  type PushInspectStatus,
} from "@/src/lib/push/permissionPrompt";
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
function mapInspectStatus(
  granted: boolean,
  canAskAgain: boolean,
  status?: Notifications.PermissionStatus
): PushInspectStatus {
  if (granted) return "granted";
  if (status === Notifications.PermissionStatus.UNDETERMINED) return "undetermined";
  if (status === Notifications.PermissionStatus.DENIED || !canAskAgain) {
    return "denied";
  }
  return canAskAgain ? "undetermined" : "denied";
}

export function PushNotificationsBridge() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading, passwordRecoveryPending } = useAuth();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const handledResponseIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    configurePushNotificationHandler();
  }, []);

  useEffect(() => {
    if (loading || passwordRecoveryPending || Platform.OS === "web") return;
    if (!user?.id) return;
    const userId = user.id;
    void (async () => {
      if (Platform.OS === "android") {
        const current = await Notifications.getPermissionsAsync();
        const permission = mapInspectStatus(
          current.granted,
          current.canAskAgain,
          current.status
        );
        const storageKey = pushFriendlyAskStorageKey(userId);
        const alreadyAsked = (await AsyncStorage.getItem(storageKey)) === "1";
        if (
          shouldExplainPushPermission({
            os: Platform.OS,
            osVersion: typeof Platform.Version === "number" ? Platform.Version : 0,
            permission,
            alreadyAsked,
          })
        ) {
          await AsyncStorage.setItem(storageKey, "1");
          await new Promise<void>((resolve) => {
            Alert.alert(
              t("settings.pushPermissionTitle"),
              t("settings.pushPermissionBody"),
              [
                {
                  text: t("settings.pushPermissionContinue"),
                  onPress: () => resolve(),
                },
              ],
              { cancelable: false, onDismiss: () => resolve() }
            );
          });
        }
      }
      await registerPushForUser(userId);
    })();
  }, [loading, passwordRecoveryPending, t, user?.id]);

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
