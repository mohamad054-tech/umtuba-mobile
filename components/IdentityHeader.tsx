import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GlobalBackButton } from "@/components/GlobalBackButton";
import { WalletTierBadge } from "@/components/WalletTierBadge";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { useTranslation } from "@/src/lib/i18n";
import { isRtlLocale } from "@/src/lib/i18n/locales";
import { GLOBAL_HEADER_LAYOUT_DIRECTION, globalHeaderBackSlot } from "@/src/lib/nav/globalBack";
import { colors } from "@/src/theme/colors";

type IdentityHeaderProps = {
  title?: string;
  onBack?: () => void;
};

export function IdentityHeader({
  title = "UMTUBA",
  onBack,
}: IdentityHeaderProps) {
  const { profile } = useAuth();
  const { t, locale } = useTranslation();
  const initial = profile?.avatar_initial || "U";
  const backAtEnd = globalHeaderBackSlot(isRtlLocale(locale)) === "right";

  const backAndTitle = (
    <View style={styles.cluster}>
      {backAtEnd ? (
        <>
          <Text style={styles.brand} numberOfLines={1}>
            {title}
          </Text>
          <GlobalBackButton onPress={onBack} />
        </>
      ) : (
        <>
          <GlobalBackButton onPress={onBack} />
          <Text style={styles.brand} numberOfLines={1}>
            {title}
          </Text>
        </>
      )}
    </View>
  );

  const chrome = (
    <View style={styles.cluster}>
      <WalletTierBadge />
      <Link href="/(tabs)/profile" asChild>
        <Pressable
          style={styles.avatar}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("identity.openProfile")}
        >
          <Text style={styles.avatarText}>{initial}</Text>
        </Pressable>
      </Link>
    </View>
  );

  return (
    <View style={styles.row} pointerEvents="box-none">
      {backAtEnd ? chrome : backAndTitle}
      {backAtEnd ? backAndTitle : chrome}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    minHeight: 44,
    direction: GLOBAL_HEADER_LAYOUT_DIRECTION,
  },
  cluster: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    minWidth: 0,
    direction: GLOBAL_HEADER_LAYOUT_DIRECTION,
  },
  brand: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1.2,
    flexShrink: 1,
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
