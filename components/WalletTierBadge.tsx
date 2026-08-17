import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { WalletBalance } from "@/src/contracts/wallet";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { useTranslation } from "@/src/lib/i18n";
import { getSupabase } from "@/src/lib/supabase/client";
import { getMyActivityTierProgress } from "@/src/lib/tiers/fetchTier";
import { loadWalletAfterWelcomeClaim } from "@/src/lib/wallet/claimWelcomeBonus";
import { formatWalletAmount } from "@/src/lib/wallet/format";
import { colors } from "@/src/theme/colors";

export function WalletTierBadge() {
  const { user, session } = useAuth();
  const { t } = useTranslation();
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [tierLabel, setTierLabel] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!session || !user) {
      setBalance(null);
      setTierLabel(null);
      setFailed(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const supabase = getSupabase();
        const [wallet, tier] = await Promise.all([
          loadWalletAfterWelcomeClaim(supabase, user.id),
          getMyActivityTierProgress(supabase, user.id),
        ]);
        if (cancelled) return;
        setBalance(wallet);
        setTierLabel(tier.tier.displayLabel);
        setFailed(false);
      } catch {
        if (cancelled) return;
        setBalance(null);
        setTierLabel(null);
        setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, user]);

  const amountLabel =
    balance != null ? `${formatWalletAmount(balance.amount)} UM` : failed ? "—" : "…";
  const tier = tierLabel ?? (failed ? t("wallet.unavailableShort") : "…");
  const a11y = failed
    ? t("wallet.unavailable")
    : t("wallet.a11y", { values: { amount: amountLabel, tier } });

  return (
    <Link href="/rewards" asChild>
      <Pressable
        style={styles.wrap}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={a11y}
      >
        <View style={styles.pill}>
          <Text style={styles.amount}>{amountLabel}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.tier}>{tier}</Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginRight: 12,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  amount: {
    color: colors.accentViolet,
    fontSize: 13,
    fontWeight: "700",
  },
  dot: {
    color: colors.textSubtle,
    fontSize: 13,
  },
  tier: {
    color: colors.accentCyan,
    fontSize: 13,
    fontWeight: "600",
  },
});
