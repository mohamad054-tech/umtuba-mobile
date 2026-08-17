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
import { getLocaleDefinition, useTranslation } from "@/src/lib/i18n";
import { chevronGlyph } from "@/src/lib/i18n/rtl";
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
  const { locale, t } = useTranslation();
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
          {chevronGlyph(locale)}
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
          row.accessibilityHint ?? t("settings.notAvailableVersion")
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
  const { t, locale } = useTranslation();
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
      Alert.alert(t("settings.unavailableTitle"), t("settings.linkUnavailable"));
      return;
    }
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) {
        Alert.alert(t("settings.unavailableTitle"), t("settings.linkUnavailableDevice"));
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(t("settings.unavailableTitle"), t("settings.linkUnavailableNow"));
    }
  }, [t]);

  const showUnavailable = useCallback((title: string, body: string) => {
    Alert.alert(title, body);
  }, []);

  const onSignOut = useCallback(() => {
    Alert.alert(t("settings.signOut"), t("settings.signOutConfirm"), [
      { text: t("actions.cancel"), style: "cancel" },
      {
        text: t("settings.signOut"),
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
                err instanceof Error ? err.message : t("settings.signOutUnable");
              Alert.alert(t("settings.signOutFailed"), message);
            } finally {
              setBusyId(null);
            }
          })();
        },
      },
    ]);
  }, [clearError, router, signOut, t]);

  const accountRows: SettingsRow[] = [
    {
      id: "edit-profile",
      label: t("settings.editProfile"),
      kind: "unavailable",
      value: t("settings.notAvailableYet"),
      onPress: () =>
        showUnavailable(t("settings.editProfile"), t("settings.editProfileBody")),
      accessibilityHint: t("settings.notAvailableYet"),
    },
    {
      id: "change-password",
      label: t("settings.changePassword"),
      kind: "link",
      href: "/change-password" as Href,
      accessibilityHint: t("settings.changePasswordHint"),
    },
    {
      id: "logout",
      label: t("settings.signOut"),
      kind: "action",
      destructive: true,
      onPress: onSignOut,
      accessibilityHint: t("settings.signOutConfirm"),
    },
    {
      id: "delete-account",
      label: t("settings.deleteAccount"),
      kind: "external",
      destructive: true,
      onPress: () => void openSupport("accountDeletion"),
      accessibilityHint: t("settings.deleteAccountHint"),
    },
  ];

  const privacyRows: SettingsRow[] = [
    {
      id: "privacy-settings",
      label: t("settings.privacySettings"),
      kind: "unavailable",
      value: t("settings.notAvailableYet"),
      onPress: () =>
        showUnavailable(
          t("settings.privacySettings"),
          t("settings.privacyUnavailable")
        ),
    },
    {
      id: "notification-inbox",
      label: t("settings.notificationsInbox"),
      kind: "link",
      href: "/notifications",
    },
    {
      id: "system-notifications",
      label: t("settings.systemNotifications"),
      kind: "action",
      onPress: () => {
        void Linking.openSettings();
      },
      accessibilityHint: t("settings.systemNotificationsHint"),
    },
    {
      id: "blocked-users",
      label: t("settings.blockedUsers"),
      kind: "link",
      href: "/blocked-users" as Href,
      accessibilityHint: t("settings.blockedUsersHint"),
    },
  ];

  const appRows: SettingsRow[] = [
    {
      id: "theme",
      label: t("settings.theme"),
      kind: "info",
      value: t("settings.themeDark"),
    },
    {
      id: "language",
      label: t("settings.language"),
      kind: "action",
      value: getLocaleDefinition(locale).nativeName,
      onPress: () => onNavigate("/language" as Href),
      accessibilityHint: t("settings.languageDescription"),
    },
    {
      id: "about",
      label: t("settings.about"),
      kind: "external",
      onPress: () => void openSupport("about"),
      accessibilityHint: t("settings.aboutHint"),
    },
    {
      id: "app-version",
      label: t("settings.appVersion"),
      kind: "info",
      value: appInfo.appVersion,
    },
  ];

  const supportRows: SettingsRow[] = [
    {
      id: "help",
      label: t("settings.help"),
      kind: "external",
      onPress: () => void openSupport("help"),
    },
    {
      id: "contact",
      label: t("settings.contact"),
      kind: "external",
      onPress: () => void openSupport("contact"),
    },
    {
      id: "privacy-policy",
      label: t("settings.privacyPolicy"),
      kind: "external",
      onPress: () => void openSupport("privacy"),
    },
    {
      id: "terms",
      label: t("settings.terms"),
      kind: "external",
      onPress: () => void openSupport("terms"),
    },
  ];

  const developerRows: SettingsRow[] = [
    {
      id: "dev-app-version",
      label: t("settings.appVersion"),
      kind: "info",
      value: appInfo.appVersion,
    },
    {
      id: "dev-build",
      label: t("settings.buildVersion"),
      kind: "info",
      value: formatBuildLabel(appInfo),
    },
    ...(typeof __DEV__ !== "undefined" && __DEV__
      ? ([
          {
            id: "dev-debug",
            label: t("settings.debugInfo"),
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
          {t("settings.subtitle")}
        </Text>

        <Section title={t("settings.sectionAccount")}>
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

        <Section title={t("settings.sectionPrivacy")}>
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

        <Section title={t("settings.sectionApp")}>
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

        <Section title={t("settings.sectionSupport")}>
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

        <Section title={t("settings.sectionDeveloper")}>
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
