import Constants from "expo-constants";
import { type Href, useRouter } from "expo-router";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/lib/auth/AuthContext";
import {
  formatBuildLabel,
  getSupportUrl,
  resolveAppInfo,
  resolveSupportUrl,
  type SupportLinkKey,
} from "@/src/lib/settings";
import { colors } from "@/src/theme/colors";

type RowKind = "link" | "action" | "external" | "unavailable" | "info";

type SettingsRow = {
  id: string;
  label: string;
  kind: RowKind;
  value?: string;
  href?: Href;
  onPress?: () => void;
  destructive?: boolean;
  accessibilityHint?: string;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function SettingsRowView({
  row,
  busyId,
  onNavigate,
}: {
  row: SettingsRow;
  busyId: string | null;
  onNavigate: (href: Href) => void;
}) {
  const busy = busyId === row.id;
  const showChevron =
    row.kind === "link" || row.kind === "external" || row.kind === "action";

  const content = (
    <>
      <View style={styles.rowText}>
        <Text
          style={[styles.rowLabel, row.destructive && styles.rowLabelDanger]}
        >
          {row.label}
        </Text>
        {row.value ? (
          <Text style={styles.rowValue} numberOfLines={2}>
            {row.value}
          </Text>
        ) : null}
      </View>
      {busy ? (
        <ActivityIndicator color={colors.accentCyan} />
      ) : showChevron ? (
        <Text style={styles.chevron} accessible={false}>
          ›
        </Text>
      ) : null}
    </>
  );

  if (row.kind === "info") {
    return (
      <View
        style={styles.row}
        accessible
        accessibilityRole="text"
        accessibilityLabel={`${row.label}${row.value ? `: ${row.value}` : ""}`}
      >
        {content}
      </View>
    );
  }

  if (row.kind === "unavailable") {
    return (
      <Pressable
        style={styles.row}
        onPress={row.onPress}
        accessibilityRole="button"
        accessibilityLabel={row.label}
        accessibilityHint={
          row.accessibilityHint ?? "Not available in this version"
        }
      >
        {content}
      </Pressable>
    );
  }

  if (row.kind === "link" && row.href) {
    const href = row.href;
    return (
      <Pressable
        style={styles.row}
        onPress={() => onNavigate(href)}
        accessibilityRole="link"
        accessibilityLabel={row.label}
        accessibilityHint={row.accessibilityHint}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <Pressable
      style={styles.row}
      onPress={row.onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={row.label}
      accessibilityHint={row.accessibilityHint}
    >
      {content}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { signOut, user, clearError } = useAuth();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const onNavigate = useCallback(
    (href: Href) => {
      router.push(href);
    },
    [router]
  );

  const appInfo = useMemo(
    () => resolveAppInfo(Constants, Platform.OS),
    []
  );

  const openSupport = useCallback(async (key: SupportLinkKey) => {
    const url = resolveSupportUrl(getSupportUrl(key));
    if (!url) {
      Alert.alert("Unavailable", "This link is not available.");
      return;
    }
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) {
        Alert.alert("Unavailable", "Unable to open this page on this device.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Unavailable", "Unable to open this page right now.");
    }
  }, []);

  const showUnavailable = useCallback((title: string, body: string) => {
    Alert.alert(title, body);
  }, []);

  const onSignOut = useCallback(() => {
    Alert.alert("Sign out", "End your session on this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBusyId("logout");
            clearError();
            try {
              await signOut();
              router.replace("/(auth)/login");
            } catch (err) {
              const message =
                err instanceof Error ? err.message : "Unable to sign out.";
              Alert.alert("Sign out failed", message);
            } finally {
              setBusyId(null);
            }
          })();
        },
      },
    ]);
  }, [clearError, router, signOut]);

  const accountRows: SettingsRow[] = [
    {
      id: "edit-profile",
      label: "Edit profile",
      kind: "unavailable",
      value: "Not available yet",
      onPress: () =>
        showUnavailable(
          "Edit profile",
          "In-app profile editing is not available in this version."
        ),
      accessibilityHint: "Not available yet",
    },
    {
      id: "change-password",
      label: "Change password",
      kind: "link",
      href: "/change-password" as Href,
      accessibilityHint: "Update your account password",
    },
    {
      id: "logout",
      label: "Sign out",
      kind: "action",
      destructive: true,
      onPress: onSignOut,
      accessibilityHint: "Ends your session on this device",
    },
    {
      id: "delete-account",
      label: "Delete account",
      kind: "external",
      destructive: true,
      onPress: () => void openSupport("accountDeletion"),
      accessibilityHint:
        "Opens the UMTUBA account deletion page in your browser",
    },
  ];

  const privacyRows: SettingsRow[] = [
    {
      id: "privacy-settings",
      label: "Privacy settings",
      kind: "unavailable",
      value: "Not available yet",
      onPress: () =>
        showUnavailable(
          "Privacy settings",
          "Privacy controls are not available in this version."
        ),
    },
    {
      id: "notification-inbox",
      label: "Notifications inbox",
      kind: "link",
      href: "/notifications",
    },
    {
      id: "system-notifications",
      label: "System notification settings",
      kind: "action",
      onPress: () => {
        void Linking.openSettings();
      },
      accessibilityHint: "Opens device settings for notification permissions",
    },
    {
      id: "blocked-users",
      label: "Blocked users",
      kind: "link",
      href: "/blocked-users" as Href,
      accessibilityHint: "Accounts hidden on this device",
    },
  ];

  const appRows: SettingsRow[] = [
    {
      id: "theme",
      label: "Theme",
      kind: "info",
      value: "Dark",
    },
    {
      id: "language",
      label: "Language",
      kind: "info",
      value: "English",
    },
    {
      id: "about",
      label: "About",
      kind: "external",
      onPress: () => void openSupport("about"),
      accessibilityHint: "Opens the UMTUBA website",
    },
    {
      id: "app-version",
      label: "App version",
      kind: "info",
      value: appInfo.appVersion,
    },
  ];

  const supportRows: SettingsRow[] = [
    {
      id: "help",
      label: "Help",
      kind: "external",
      onPress: () => void openSupport("help"),
    },
    {
      id: "contact",
      label: "Contact",
      kind: "external",
      onPress: () => void openSupport("contact"),
    },
    {
      id: "privacy-policy",
      label: "Privacy Policy",
      kind: "external",
      onPress: () => void openSupport("privacy"),
    },
    {
      id: "terms",
      label: "Terms",
      kind: "external",
      onPress: () => void openSupport("terms"),
    },
  ];

  const developerRows: SettingsRow[] = [
    {
      id: "dev-app-version",
      label: "App version",
      kind: "info",
      value: appInfo.appVersion,
    },
    {
      id: "dev-build",
      label: "Build version",
      kind: "info",
      value: formatBuildLabel(appInfo),
    },
    ...(typeof __DEV__ !== "undefined" && __DEV__
      ? ([
          {
            id: "dev-debug",
            label: "Debug info",
            kind: "info",
            value: [
              `platform=${appInfo.platform}`,
              appInfo.appOwnership
                ? `ownership=${appInfo.appOwnership}`
                : null,
              appInfo.channel ? `env=${appInfo.channel}` : null,
              user?.id ? `user=${user.id.slice(0, 8)}…` : null,
            ]
              .filter(Boolean)
              .join(" · "),
          } satisfies SettingsRow,
        ] as SettingsRow[])
      : []),
  ];

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.subtitle}>
          Account, privacy, and app preferences.
        </Text>

        <Section title="Account">
          {accountRows.map((row, index) => (
            <View key={row.id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <SettingsRowView
                row={row}
                busyId={busyId}
                onNavigate={onNavigate}
              />
            </View>
          ))}
        </Section>

        <Section title="Privacy">
          {privacyRows.map((row, index) => (
            <View key={row.id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <SettingsRowView
                row={row}
                busyId={busyId}
                onNavigate={onNavigate}
              />
            </View>
          ))}
        </Section>

        <Section title="App">
          {appRows.map((row, index) => (
            <View key={row.id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <SettingsRowView
                row={row}
                busyId={busyId}
                onNavigate={onNavigate}
              />
            </View>
          ))}
        </Section>

        <Section title="Support">
          {supportRows.map((row, index) => (
            <View key={row.id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <SettingsRowView
                row={row}
                busyId={busyId}
                onNavigate={onNavigate}
              />
            </View>
          ))}
        </Section>

        <Section title="Developer">
          {developerRows.map((row, index) => (
            <View key={row.id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <SettingsRowView
                row={row}
                busyId={busyId}
                onNavigate={onNavigate}
              />
            </View>
          ))}
        </Section>
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  subtitle: {
    color: colors.textMuted,
    marginBottom: 18,
    lineHeight: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  row: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  rowLabelDanger: {
    color: colors.danger,
  },
  rowValue: {
    color: colors.textSubtle,
    fontSize: 13,
    lineHeight: 18,
  },
  chevron: {
    color: colors.textSubtle,
    fontSize: 22,
    lineHeight: 22,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 14,
  },
});
