import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { emptyActivityTierProgress } from "@/src/contracts/tiers";
import type { WalletBalance } from "@/src/contracts/wallet";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { getSupabase } from "@/src/lib/supabase/client";
import { getMyActivityTierProgress } from "@/src/lib/tiers/fetchTier";
import { fetchUmPointsWalletBalance } from "@/src/lib/wallet/fetchBalance";
import { formatWalletAmount } from "@/src/lib/wallet/format";
import { colors } from "@/src/theme/colors";

export function WalletTierBadge() {
  const { user, session } = useAuth();
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [tierLabel, setTierLabel] = useState("Spark");

  useEffect(() => {
    if (!session || !user) {
      setBalance(null);
      setTierLabel("Spark");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const supabase = getSupabase();
        const [wallet, tier] = await Promise.all([
          fetchUmPointsWalletBalance(supabase, user.id),
          getMyActivityTierProgress(supabase, user.id),
        ]);
        if (cancelled) return;
        setBalance(wallet);
        setTierLabel(tier.tier.displayLabel);
      } catch {
        if (cancelled) return;
        setBalance({
          assetId: "um_points",
          amount: 0,
          updatedAt: null,
        });
        setTierLabel(emptyActivityTierProgress().tier.displayLabel);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, user]);

  const amount = formatWalletAmount(balance?.amount ?? 0);

  return (
    <Link href="/rewards" asChild>
      <Pressable style={styles.wrap} hitSlop={8}>
        <View style={styles.pill}>
          <Text style={styles.amount}>{amount} UM</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.tier}>{tierLabel}</Text>
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
