import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { ActivityTierProgress } from "@/src/contracts/tiers";
import type { WalletBalance } from "@/src/contracts/wallet";
import { getErrorMessage } from "@/src/contracts/validation";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { getSupabase } from "@/src/lib/supabase/client";
import { getMyActivityTierProgress } from "@/src/lib/tiers/fetchTier";
import { fetchUmPointsWalletBalance } from "@/src/lib/wallet/fetchBalance";
import { formatWalletAmountExact } from "@/src/lib/wallet/format";
import { colors } from "@/src/theme/colors";

export default function RewardsScreen() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [tier, setTier] = useState<ActivityTierProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const [wallet, progress] = await Promise.all([
        fetchUmPointsWalletBalance(supabase, user.id),
        getMyActivityTierProgress(supabase, user.id),
      ]);
      setBalance(wallet);
      setTier(progress);
    } catch (err) {
      setBalance(null);
      setTier(null);
      setError(getErrorMessage(err, "Unable to load rewards."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when user changes
  }, [user?.id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accentCyan} />
      </View>
    );
  }

  if (error || !balance || !tier) {
    return (
      <View style={styles.center}>
        <Text style={styles.error} accessibilityRole="alert">
          {error ?? "Unable to load rewards."}
        </Text>
        <Pressable
          onPress={() => void load()}
          accessibilityRole="button"
          accessibilityLabel="Retry loading rewards"
        >
          <Text style={styles.retry}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.label}>UM Points</Text>
      <Text
        style={styles.amount}
        accessibilityLabel={`${formatWalletAmountExact(balance.amount)} UM Points`}
      >
        {formatWalletAmountExact(balance.amount)}
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
    gap: 12,
    padding: 24,
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
  error: {
    color: colors.danger,
    textAlign: "center",
  },
  retry: {
    color: colors.accentCyan,
    fontWeight: "700",
  },
});
