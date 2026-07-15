import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { WalletTierBadge } from "@/components/WalletTierBadge";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { colors } from "@/src/theme/colors";

type IdentityHeaderProps = {
  title?: string;
};

export function IdentityHeader({ title = "UMTUBA" }: IdentityHeaderProps) {
  const { profile } = useAuth();
  const initial = profile?.avatar_initial || "U";

  return (
    <View style={styles.row}>
      <Text style={styles.brand} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>
        <WalletTierBadge />
        <Link href="/profile" asChild>
          <Pressable style={styles.avatar} hitSlop={8}>
            <Text style={styles.avatarText}>{initial}</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    minHeight: 44,
  },
  brand: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1.2,
    flexShrink: 1,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 13,
  },
});
