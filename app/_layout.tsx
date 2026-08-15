import { DarkTheme, Stack, ThemeProvider, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { GlobalBackButton } from "@/components/GlobalBackButton";
import { AuthProvider, useAuth } from "@/src/lib/auth/AuthContext";
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
    return (
      <View style={configStyles.root} accessibilityRole="alert">
        <Text style={configStyles.brand}>UMTUBA</Text>
        <Text style={configStyles.title}>Configuration needed</Text>
        <Text style={configStyles.body}>
          Copy `.env.example` to `.env` and set your public Supabase URL and
          publishable key. Never add a service-role secret.
        </Text>
        <Pressable
          style={configStyles.button}
          onPress={() => void restore()}
          accessibilityRole="button"
          accessibilityLabel="Retry configuration"
        >
          <Text style={configStyles.buttonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
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
      <AuthProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style="light" />
          <SplashGate>
            <DeepLinkHandler />
            <PushNotificationsBridge />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                contentStyle: { backgroundColor: colors.bg },
                ...GLOBAL_STACK_HEADER_OPTIONS,
                headerLeft: () => <GlobalBackButton />,
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen
                name="(tabs)"
                options={{ headerShown: false, title: "" }}
              />
              <Stack.Screen name="profile/index" options={{ title: "Profile" }} />
              <Stack.Screen
                name="notifications"
                options={{ title: "Notifications" }}
              />
              <Stack.Screen name="rewards" options={{ title: "Rewards" }} />
              <Stack.Screen name="world" options={{ title: "World" }} />
              <Stack.Screen name="settings" options={{ title: "Settings" }} />
              <Stack.Screen
                name="blocked-users"
                options={{ title: "Blocked users" }}
              />
              <Stack.Screen
                name="change-password"
                options={{ title: "Change password" }}
              />
              <Stack.Screen
                name="messages/[id]"
                options={{ title: "Conversation" }}
              />
              <Stack.Screen
                name="invite/[code]"
                options={{ headerShown: false }}
              />
            </Stack>
          </SplashGate>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
