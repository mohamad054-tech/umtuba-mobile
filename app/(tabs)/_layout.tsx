import { Redirect, Tabs } from "expo-router";
import { Platform, Text, type ColorValue } from "react-native";

import { TabBarIcon } from "@/components/TabBarIcon";
import { useGlobalHeaderSlots } from "@/components/GlobalBackButton";
import { WalletTierBadge } from "@/components/WalletTierBadge";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { useTranslation } from "@/src/lib/i18n";
import { GLOBAL_BACK_TITLE_OPTIONS } from "@/src/lib/nav/globalBack";
import {
  TAB_BAR_MIN_HEIGHT,
  TAB_ITEM_MIN_HEIGHT,
  TAB_LABEL_FONT_SIZE,
  TAB_LABEL_MAX_WIDTH,
  tabIconSize,
} from "@/src/lib/nav/tabBarMetrics";
import { colors } from "@/src/theme/colors";

function TabLabel({
  label,
  color,
}: {
  label: string;
  color: ColorValue;
}) {
  return (
    <Text
      style={{
        color,
        fontSize: TAB_LABEL_FONT_SIZE,
        fontWeight: "700",
        maxWidth: TAB_LABEL_MAX_WIDTH,
        textAlign: "center",
      }}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.72}
    >
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
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          minHeight: TAB_BAR_MIN_HEIGHT,
          paddingTop: 6,
        },
        tabBarItemStyle: {
          minHeight: TAB_ITEM_MIN_HEIGHT,
          paddingVertical: 4,
        },
        tabBarIconStyle: {
          width: 32,
          height: 32,
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
          tabBarLabel: ({ color }) => (
            <TabLabel label={t("nav.watch")} color={color} />
          ),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              id="watch"
              color={color}
              size={tabIconSize("watch")}
              focused={focused}
            />
          ),
          tabBarAccessibilityLabel: t("nav.watch"),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: t("nav.discover"),
          tabBarLabel: ({ color }) => (
            <TabLabel label={t("nav.discover")} color={color} />
          ),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              id="discover"
              color={color}
              size={tabIconSize("discover")}
              focused={focused}
            />
          ),
          tabBarAccessibilityLabel: t("nav.discover"),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: t("nav.create"),
          tabBarLabel: ({ color }) => (
            <TabLabel label={t("nav.create")} color={color} />
          ),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              id="create"
              color={color}
              size={tabIconSize("create")}
              focused={focused}
            />
          ),
          tabBarAccessibilityLabel: t("nav.create"),
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: t("nav.live"),
          // Unfinished Live join is an App Review risk on iOS. Android unchanged.
          href: Platform.OS === "ios" ? null : "/(tabs)/live",
          tabBarLabel: ({ color }) => (
            <TabLabel label={t("nav.live")} color={color} />
          ),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              id="live"
              color={color}
              size={tabIconSize("live")}
              focused={focused}
            />
          ),
          tabBarAccessibilityLabel: t("nav.live"),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t("nav.messages"),
          tabBarLabel: ({ color }) => (
            <TabLabel label={t("nav.messages")} color={color} />
          ),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              id="messages"
              color={color}
              size={tabIconSize("messages")}
              focused={focused}
            />
          ),
          tabBarAccessibilityLabel: t("nav.messages"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav.profile"),
          tabBarLabel: ({ color }) => (
            <TabLabel label={t("nav.profile")} color={color} />
          ),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              id="profile"
              color={color}
              size={tabIconSize("profile")}
              focused={focused}
            />
          ),
          tabBarAccessibilityLabel: t("nav.profile"),
        }}
      />
    </Tabs>
  );
}
