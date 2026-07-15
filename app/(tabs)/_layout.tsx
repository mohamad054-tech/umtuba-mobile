import { Redirect, Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";

import { WalletTierBadge } from "@/components/WalletTierBadge";
import { useAuth } from "@/src/lib/auth/AuthContext";
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
  const { session, loading } = useAuth();

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
    </Tabs>
  );
}
