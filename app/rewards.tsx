import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import {
  emptyActivityTierProgress,
  type ActivityTierProgress,
} from "@/src/contracts/tiers";
import type { WalletBalance } from "@/src/contracts/wallet";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { getSupabase } from "@/src/lib/supabase/client";
import { getMyActivityTierProgress } from "@/src/lib/tiers/fetchTier";
import { fetchUmPointsWalletBalance } from "@/src/lib/wallet/fetchBalance";
import { formatWalletAmountExact } from "@/src/lib/wallet/format";
import { colors } from "@/src/theme/colors";

export default function RewardsScreen() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [tier, setTier] = useState<ActivityTierProgress>(
    emptyActivityTierProgress()
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabase();
        const [wallet, progress] = await Promise.all([
          fetchUmPointsWalletBalance(supabase, user.id),
          getMyActivityTierProgress(supabase, user.id),
        ]);
        if (cancelled) return;
        setBalance(wallet);
        setTier(progress);
      } catch {
        if (!cancelled) {
          setBalance({ assetId: "um_points", amount: 0, updatedAt: null });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accentCyan} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.label}>UM Points</Text>
      <Text style={styles.amount}>
        {formatWalletAmountExact(balance?.amount ?? 0)}
      </Text>
      <Text style={styles.tier}>
        {tier.tier.icon} {tier.tier.displayTitle}
      </Text>
      <Text style={styles.meta}>
        Score {tier.score}
        {tier.nextTier
          ? ` · ${tier.pointsToNext} to ${tier.nextTier.displayLabel}`
          : " · Max tier"}
      </Text>
      <Text style={styles.note}>
        Conversion to a future UMTUBA token is not available yet.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 6,
  },
  amount: {
    color: colors.accentViolet,
    fontSize: 40,
    fontWeight: "800",
    marginBottom: 16,
  },
  tier: {
    color: colors.accentCyan,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  meta: {
    color: colors.textMuted,
    marginBottom: 20,
  },
  note: {
    color: colors.textSubtle,
    lineHeight: 20,
  },
});
