import { Redirect, Tabs } from "expo-router";
import { Platform, Text, type ColorValue } from "react-native";

import { GlobalBackButton } from "@/components/GlobalBackButton";
import { WalletTierBadge } from "@/components/WalletTierBadge";
import { useAuth } from "@/src/lib/auth/AuthContext";
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
    <Text style={{ color, fontSize: 11, fontWeight: "600" }}>{label}</Text>
  );
}

export default function TabLayout() {
  const { session, loading, passwordRecoveryPending } = useAuth();

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
        headerLeft: () => <GlobalBackButton />,
        headerRight: () => <WalletTierBadge />,
      }}
    >
      <Tabs.Screen
        name="watch"
        options={{
          title: "Watch",
          headerShown: false,
          tabBarIcon: ({ color }) => <TabLabel label="▶" color={color} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color }) => <TabLabel label="◎" color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Create",
          tabBarIcon: ({ color }) => <TabLabel label="＋" color={color} />,
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: "Live",
          // Unfinished Live join is an App Review risk on iOS. Android unchanged.
          href: Platform.OS === "ios" ? null : "/(tabs)/live",
          tabBarIcon: ({ color }) => <TabLabel label="◉" color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color }) => <TabLabel label="✉" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <TabLabel label="☺" color={color} />,
        }}
      />
    </Tabs>
  );
}
