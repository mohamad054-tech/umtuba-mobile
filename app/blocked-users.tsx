import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";

import {
  loadBlockedUsers,
  unblockUserLocally,
  type BlockedUserRecord,
} from "@/src/lib/social/ugcModeration";
import { colors } from "@/src/theme/colors";

export default function BlockedUsersScreen() {
  const [users, setUsers] = useState<BlockedUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await loadBlockedUsers());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const onUnblock = useCallback((row: BlockedUserRecord) => {
    Alert.alert(
      "Unblock account",
      row.username
        ? `Show @${row.username.replace(/^@/, "")} again on this device?`
        : "Show this account again on this device?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: () => {
            void (async () => {
              setBusyId(row.userId);
              try {
                setUsers(await unblockUserLocally(row.userId));
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ]
    );
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.subtitle}>
          Accounts you block are hidden on this device and stored with your
          UMTUBA account when signed in.
        </Text>

        {loading ? (
          <ActivityIndicator
            color={colors.accentCyan}
            accessibilityLabel="Loading blocked accounts"
          />
        ) : users.length === 0 ? (
          <Text style={styles.empty}>No blocked accounts on this device.</Text>
        ) : (
          <View style={styles.card}>
            {users.map((row, index) => (
              <View key={row.userId}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.label}>
                      {row.username
                        ? `@${row.username.replace(/^@/, "")}`
                        : "Blocked account"}
                    </Text>
                    <Text style={styles.value}>
                      Hidden on this device
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => onUnblock(row)}
                    disabled={busyId === row.userId}
                    accessibilityRole="button"
                    accessibilityLabel={
                      row.username
                        ? `Unblock ${row.username}`
                        : "Unblock account"
                    }
                  >
                    {busyId === row.userId ? (
                      <ActivityIndicator color={colors.accentCyan} />
                    ) : (
                      <Text style={styles.unblock}>Unblock</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  subtitle: {
    color: colors.textMuted,
    marginBottom: 18,
    lineHeight: 20,
  },
  empty: {
    color: colors.textSubtle,
    lineHeight: 20,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  row: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  value: {
    color: colors.textSubtle,
    fontSize: 13,
    lineHeight: 18,
  },
  unblock: {
    color: colors.accentCyan,
    fontWeight: "700",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 14,
  },
});
