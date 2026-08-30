import { Redirect, Tabs } from "expo-router";
import { I18nManager, Text, type ColorValue } from "react-native";

import { UmLifeTabIcon } from "@/components/nav/UmLifeTabIcon";
import { WalletTierBadge } from "@/components/WalletTierBadge";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { umLifeNavCopy } from "@/src/lib/nav/umLifeHomeEntry";
import { colors } from "@/src/theme/colors";

function TabLabel({
  label,
  color,
}: {
  label: string;
  color: ColorValue;
}) {
  return (
    <Text style={{ color, fontSize: 11, fontWeight: "600" }}>{label}</Text>
  );
}

export default function TabLayout() {
  const { session, loading, passwordRecoveryPending } = useAuth();
  const copy = umLifeNavCopy(I18nManager.isRTL ? "ar" : "en");

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
        headerRight: () => <WalletTierBadge />,
      }}
    >
      <Tabs.Screen
        name="watch"
        options={{
          title: copy.watch,
          headerShown: false,
          tabBarAccessibilityLabel: copy.watch,
          tabBarIcon: ({ color }) => <TabLabel label="▶" color={color} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "UM Life",
          tabBarAccessibilityLabel: copy.umLifeAria,
          tabBarIcon: ({ color }) => <UmLifeTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: copy.create,
          tabBarAccessibilityLabel: copy.create,
          tabBarIcon: ({ color }) => <TabLabel label="＋" color={color} />,
        }}
      />
      <Tabs.Screen
        name="learning"
        options={{
          title: copy.learning,
          tabBarAccessibilityLabel: copy.learning,
          tabBarIcon: ({ color }) => <TabLabel label="▣" color={color} />,
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: copy.store,
          tabBarAccessibilityLabel: copy.store,
          tabBarIcon: ({ color }) => <TabLabel label="⌂" color={color} />,
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: "Live",
          href: null,
          tabBarIcon: ({ color }) => <TabLabel label="◉" color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          href: null,
          tabBarIcon: ({ color }) => <TabLabel label="✉" color={color} />,
        }}
      />
    </Tabs>
  );
}
