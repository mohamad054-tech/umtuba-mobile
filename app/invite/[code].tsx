import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { normalizeReferralCode } from "@/src/contracts/referral";
import { saveReferralAttribution } from "@/src/lib/auth/referralAttribution";
import { colors } from "@/src/theme/colors";

export default function InviteCodeScreen() {
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const [ready, setReady] = useState(false);
  const code = normalizeReferralCode(
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (code) {
        await saveReferralAttribution(code);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accentCyan} />
      </View>
    );
  }

  const href = code
    ? `/(auth)/signup?ref=${encodeURIComponent(code)}`
    : "/(auth)/signup";

  return <Redirect href={href as never} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
