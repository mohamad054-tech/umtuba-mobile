import { DarkTheme, Stack, ThemeProvider, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "@/src/lib/auth/AuthContext";
import { saveReferralAttribution } from "@/src/lib/auth/referralAttribution";
import {
  deepLinkToHref,
  parseDeepLink,
} from "@/src/lib/linking/deepLinks";
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

  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return;
      const parsed = parseDeepLink(url);
      if (parsed.referralCode) {
        await saveReferralAttribution(parsed.referralCode);
      }
      const href = deepLinkToHref(parsed.target);
      router.push(href as never);
    };

    void Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener("url", (event) => {
      void handleUrl(event.url);
    });
    return () => sub.remove();
  }, [router]);

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
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="profile/index" options={{ title: "Profile" }} />
              <Stack.Screen
                name="notifications"
                options={{ title: "Notifications" }}
              />
              <Stack.Screen name="rewards" options={{ title: "Rewards" }} />
              <Stack.Screen name="settings" options={{ title: "Settings" }} />
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
