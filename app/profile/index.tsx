import { Link, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/lib/auth/AuthContext";
import { buildProfilePresentation } from "@/src/lib/profile";
import { colors } from "@/src/theme/colors";

export default function ProfileScreen() {
  const { profile, user, loading, error, restore, clearError } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const view = buildProfilePresentation(profile, user);

  const onRetry = useCallback(async () => {
    clearError();
    setRefreshing(true);
    try {
      await restore();
    } finally {
      setRefreshing(false);
    }
  }, [clearError, restore]);

  if (loading && !user) {
    return (
      <SafeAreaView style={styles.root} edges={["bottom"]}>
        <View
          style={styles.center}
          accessibilityLabel="Loading profile"
          accessibilityRole="progressbar"
        >
          <ActivityIndicator color={colors.accentCyan} size="large" />
          <Text style={styles.muted}>Loading profile…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.root} edges={["bottom"]}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle} accessibilityRole="header">
            Sign in required
          </Text>
          <Text style={styles.muted}>
            Sign in to view your profile and account settings.
          </Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.replace("/(auth)/login")}
            accessibilityRole="button"
            accessibilityLabel="Go to sign in"
          >
            <Text style={styles.primaryBtnText}>Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={styles.avatar}
          accessibilityLabel={
            view.hasReliableIdentity
              ? `Avatar for ${view.displayName || view.username || "you"}`
              : "Profile avatar placeholder"
          }
        >
          {view.avatarUrl ? (
            <Image
              source={{ uri: view.avatarUrl }}
              style={styles.avatarImage}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Text style={styles.avatarText} accessible={false}>
              {view.avatarInitial}
            </Text>
          )}
        </View>

        {view.hasReliableIdentity ? (
          <>
            <Text style={styles.name} accessibilityRole="header">
              {view.displayName || view.username || "Account"}
            </Text>
            {view.username ? (
              <Text style={styles.username}>@{view.username}</Text>
            ) : null}
            {view.bio ? <Text style={styles.bio}>{view.bio}</Text> : null}
            {view.locationLine ? (
              <Text style={styles.meta}>{view.locationLine}</Text>
            ) : null}
            {view.email ? (
              <Text
                style={styles.meta}
                accessibilityLabel={`Email ${view.email}`}
              >
                {view.email}
              </Text>
            ) : null}
          </>
        ) : (
          <View style={styles.banner} accessibilityRole="alert">
            <Text style={styles.emptyTitle}>Profile details unavailable</Text>
            <Text style={styles.muted}>
              We couldn’t load a reliable identity for this account yet.
            </Text>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => void onRetry()}
              disabled={refreshing}
              accessibilityRole="button"
              accessibilityLabel="Retry loading profile"
            >
              {refreshing ? (
                <ActivityIndicator color={colors.accentCyan} />
              ) : (
                <Text style={styles.secondaryBtnText}>Retry</Text>
              )}
            </Pressable>
          </View>
        )}

        {error ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              onPress={() => void onRetry()}
              accessibilityRole="button"
              accessibilityLabel="Retry after error"
            >
              <Text style={styles.retryLink}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Shortcuts</Text>
        <View style={styles.links}>
          <Link href="/rewards" asChild>
            <Pressable
              style={styles.linkRow}
              accessibilityRole="link"
              accessibilityLabel="Open rewards"
            >
              <Text style={styles.linkText}>Rewards</Text>
              <Text style={styles.chevron} accessible={false}>
                ›
              </Text>
            </Pressable>
          </Link>
          <Link href="/notifications" asChild>
            <Pressable
              style={styles.linkRow}
              accessibilityRole="link"
              accessibilityLabel="Open notifications"
            >
              <Text style={styles.linkText}>Notifications</Text>
              <Text style={styles.chevron} accessible={false}>
                ›
              </Text>
            </Pressable>
          </Link>
          <Link href="/settings" asChild>
            <Pressable
              style={styles.linkRow}
              accessibilityRole="link"
              accessibilityLabel="Open settings"
            >
              <Text style={styles.linkText}>Settings</Text>
              <Text style={styles.chevron} accessible={false}>
                ›
              </Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "700",
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
  },
  username: {
    color: colors.accentCyan,
    marginTop: 4,
    marginBottom: 10,
  },
  bio: {
    color: colors.textMuted,
    marginBottom: 8,
    lineHeight: 20,
  },
  meta: {
    color: colors.textSubtle,
    fontSize: 13,
    marginBottom: 4,
  },
  muted: {
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  banner: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  errorBox: {
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  errorText: {
    color: colors.danger,
    marginBottom: 8,
  },
  retryLink: {
    color: colors.accentCyan,
    fontWeight: "600",
  },
  sectionLabel: {
    marginTop: 24,
    marginBottom: 10,
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  links: {
    gap: 10,
  },
  linkRow: {
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  linkText: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 16,
  },
  chevron: {
    color: colors.textSubtle,
    fontSize: 22,
    lineHeight: 22,
  },
  primaryBtn: {
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.accentViolet,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: colors.text,
    fontWeight: "700",
  },
  secondaryBtn: {
    marginTop: 4,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryBtnText: {
    color: colors.accentCyan,
    fontWeight: "700",
  },
});
