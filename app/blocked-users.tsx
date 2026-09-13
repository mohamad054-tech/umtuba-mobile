import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/lib/auth/AuthContext";
import {
  listMyBlockedUsers,
  unblockUgcUser,
  type BlockedUser,
} from "@/src/lib/safety/blocks";
import { getSupabase } from "@/src/lib/supabase/client";
import { colors } from "@/src/theme/colors";

export default function BlockedUsersScreen() {
  const { user, session } = useAuth();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listMyBlockedUsers(getSupabase());
    if (!result.ok) {
      setUsers([]);
      setError(result.message);
      setLoading(false);
      return;
    }
    setUsers(result.users);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onUnblock = useCallback(async (userId: string) => {
    setBusyId(userId);
    const result = await unblockUgcUser(getSupabase(), userId);
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setUsers((prev) => prev.filter((item) => item.userId !== userId));
  }, []);

  if (!session || !user) {
    return (
      <SafeAreaView style={styles.center} edges={["bottom"]}>
        <Text style={styles.body}>Sign in to manage blocked accounts.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.body}>
          Blocked accounts cannot message you. Their videos are hidden from
          Watch and Discover.
        </Text>
        {loading ? (
          <ActivityIndicator color={colors.accentCyan} />
        ) : error ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Text style={styles.error}>{error}</Text>
            <Pressable
              onPress={() => void load()}
              accessibilityRole="button"
              accessibilityLabel="Retry loading blocked accounts"
            >
              <Text style={styles.link}>Retry</Text>
            </Pressable>
          </View>
        ) : users.length === 0 ? (
          <Text style={styles.empty}>No blocked accounts.</Text>
        ) : (
          users.map((item) => (
            <View key={item.userId} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.name}>
                  {item.displayName || item.username || "UMTUBA user"}
                </Text>
                {item.username ? (
                  <Text style={styles.meta}>@{item.username}</Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => void onUnblock(item.userId)}
                disabled={busyId === item.userId}
                accessibilityRole="button"
                accessibilityLabel={`Unblock ${item.displayName || item.username || "user"}`}
              >
                {busyId === item.userId ? (
                  <ActivityIndicator color={colors.accentCyan} />
                ) : (
                  <Text style={styles.link}>Unblock</Text>
                )}
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, gap: 12 },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  body: { color: colors.textMuted, lineHeight: 20 },
  empty: { color: colors.textMuted, marginTop: 12 },
  errorBox: { gap: 8 },
  error: { color: colors.danger },
  row: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowText: { flex: 1, gap: 2 },
  name: { color: colors.text, fontWeight: "700", fontSize: 16 },
  meta: { color: colors.textSubtle, fontSize: 13 },
  link: { color: colors.accentCyan, fontWeight: "700" },
});
