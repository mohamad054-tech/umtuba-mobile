import { Redirect, Tabs } from "expo-router";
import { Platform, Text, type ColorValue } from "react-native";

import { useGlobalHeaderSlots } from "@/components/GlobalBackButton";
import { WalletTierBadge } from "@/components/WalletTierBadge";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { useTranslation } from "@/src/lib/i18n";
import { GLOBAL_BACK_TITLE_OPTIONS } from "@/src/lib/nav/globalBack";
import { colors } from "@/src/theme/colors";

function TabLabel({
  label,
  color,
}: {
  label: string;
  color: ColorValue;
}) {
  return (
    <Text style={{ color, fontSize: 11, fontWeight: "600" }} numberOfLines={1}>
      {label}
    </Text>
  );
}

export default function TabLayout() {
  const { session, loading, passwordRecoveryPending } = useAuth();
  const { t } = useTranslation();
  const headerSlots = useGlobalHeaderSlots({
    companion: () => <WalletTierBadge />,
  });

  if (!loading && session && passwordRecoveryPending) {
    return <Redirect href="/(auth)/update-password" />;
  }

  if (!loading && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accentCyan,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        ...GLOBAL_BACK_TITLE_OPTIONS,
        ...headerSlots,
      }}
    >
      <Tabs.Screen
        name="watch"
        options={{
          title: t("nav.watch"),
          headerShown: false,
          tabBarIcon: ({ color }) => <TabLabel label="▶" color={color} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: t("nav.discover"),
          tabBarIcon: ({ color }) => <TabLabel label="◎" color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: t("nav.create"),
          tabBarIcon: ({ color }) => <TabLabel label="＋" color={color} />,
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: t("nav.live"),
          // Unfinished Live join is an App Review risk on iOS. Android unchanged.
          href: Platform.OS === "ios" ? null : "/(tabs)/live",
          tabBarIcon: ({ color }) => <TabLabel label="◉" color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t("nav.messages"),
          tabBarIcon: ({ color }) => <TabLabel label="✉" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav.profile"),
          tabBarIcon: ({ color }) => <TabLabel label="☺" color={color} />,
        }}
      />
    </Tabs>
  );
}
