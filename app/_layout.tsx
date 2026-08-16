import { DarkTheme, Stack, ThemeProvider, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { useGlobalHeaderSlots } from "@/components/GlobalBackButton";
import { AuthProvider, useAuth } from "@/src/lib/auth/AuthContext";
import { I18nProvider, useTranslation } from "@/src/lib/i18n";
import { POST_AUTH_HREF } from "@/src/lib/auth/postAuthDestination";
import { saveReferralAttribution } from "@/src/lib/auth/referralAttribution";
import { GLOBAL_STACK_HEADER_OPTIONS } from "@/src/lib/nav/globalBack";
import {
  establishEmailConfirmSession,
  isEmailConfirmCallbackUrl,
} from "@/src/lib/auth/emailConfirm";
import {
  establishRecoverySession,
  isRecoveryCallbackUrl,
  parseRecoveryAuthUrl,
} from "@/src/lib/auth/passwordRecovery";
import {
  deepLinkToHref,
  parseDeepLink,
} from "@/src/lib/linking/deepLinks";
import { PushNotificationsBridge } from "@/src/lib/push/PushNotificationsBridge";
import { getSupabase } from "@/src/lib/supabase/client";
import { colors } from "@/src/theme/colors";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "index",
};

SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.accentViolet,
  },
};

function DeepLinkHandler() {
  const router = useRouter();
  const { markPasswordRecoveryPending } = useAuth();

  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return;

      if (isRecoveryCallbackUrl(url)) {
        const recovery = parseRecoveryAuthUrl(url);
        const result = await establishRecoverySession(getSupabase(), recovery);
        if (!result.ok) {
          router.push({
            pathname: "/(auth)/update-password",
            params: { error: result.message },
          } as never);
          return;
        }
        markPasswordRecoveryPending();
        router.push("/(auth)/update-password" as never);
        return;
      }

      if (isEmailConfirmCallbackUrl(url)) {
        const parsed = parseRecoveryAuthUrl(url);
        const result = await establishEmailConfirmSession(getSupabase(), parsed);
        if (!result.ok) {
          router.push({
            pathname: "/(auth)/login",
            params: { error: result.message },
          } as never);
          return;
        }
        router.replace(POST_AUTH_HREF as never);
        return;
      }

      const parsed = parseDeepLink(url);
      if (parsed.referralCode) {
        await saveReferralAttribution(parsed.referralCode);
      }
      if (parsed.target.type === "update-password") {
        router.push("/(auth)/update-password" as never);
        return;
      }
      const href = deepLinkToHref(parsed.target);
      router.push(href as never);
    };

    void Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener("url", (event) => {
      void handleUrl(event.url);
    });
    return () => sub.remove();
  }, [markPasswordRecoveryPending, router]);

  return null;
}

function SplashGate({ children }: { children: ReactNode }) {
  const { loading, configError, restore } = useAuth();

  useEffect(() => {
    if (!loading) {
      void SplashScreen.hideAsync();
    }
  }, [loading]);

  if (loading) {
    return null;
  }

  if (configError) {
    return <ConfigNeeded onRetry={() => void restore()} />;
  }

  return <>{children}</>;
}

function ConfigNeeded({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={configStyles.root} accessibilityRole="alert">
      <Text style={configStyles.brand}>UMTUBA</Text>
      <Text style={configStyles.title}>{t("auth.config.title")}</Text>
      <Text style={configStyles.body}>{t("auth.config.body")}</Text>
      <Pressable
        style={configStyles.button}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={t("auth.config.retry")}
      >
        <Text style={configStyles.buttonText}>{t("actions.retry")}</Text>
      </Pressable>
    </View>
  );
}

function LocalizedStack() {
  const { t } = useTranslation();
  const headerSlots = useGlobalHeaderSlots();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
        ...GLOBAL_STACK_HEADER_OPTIONS,
        ...headerSlots,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "" }} />
      <Stack.Screen name="profile/index" options={{ title: t("nav.profile") }} />
      <Stack.Screen
        name="notifications"
        options={{ title: t("settings.notifications") }}
      />
      <Stack.Screen name="rewards" options={{ title: t("rewards.title") }} />
      <Stack.Screen name="world" options={{ title: t("nav.world") }} />
      <Stack.Screen name="settings" options={{ title: t("settings.title") }} />
      <Stack.Screen name="language" options={{ title: t("language.title") }} />
      <Stack.Screen
        name="blocked-users"
        options={{ title: t("settings.blockedUsers") }}
      />
      <Stack.Screen
        name="change-password"
        options={{ title: t("settings.changePassword") }}
      />
      <Stack.Screen
        name="messages/[id]"
        options={{ title: t("nav.conversation") }}
      />
      <Stack.Screen name="invite/[code]" options={{ headerShown: false }} />
    </Stack>
  );
}

const configStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  brand: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 20,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
  },
  body: {
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    alignSelf: "flex-start",
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: {
    color: colors.bg,
    fontWeight: "700",
  },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <ThemeProvider value={navTheme}>
            <StatusBar style="light" />
            <SplashGate>
              <DeepLinkHandler />
              <PushNotificationsBridge />
              <LocalizedStack />
            </SplashGate>
          </ThemeProvider>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
