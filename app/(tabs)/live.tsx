import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LiveSessionCard } from "@/components/live/LiveSessionCard";
import { LiveStatePanel } from "@/components/live/LiveStatePanel";
import {
  loadLiveLobby,
  resolveLiveJoin,
  type LiveLobbyPhase,
  type LiveSession,
} from "@/src/lib/live";
import { colors } from "@/src/theme/colors";

export default function LiveScreen() {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<LiveLobbyPhase>("loading");
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    const soft = opts?.soft === true;
    if (!soft) setPhase("loading");
    setError(null);
    try {
      const result = await loadLiveLobby();
      if (!result.ok) {
        setSessions([]);
        setError(result.message);
        setPhase(result.unavailable ? "unavailable" : "error");
        return;
      }
      setSessions(result.sessions);
      setPhase(result.sessions.length === 0 ? "empty" : "ready");
    } catch (err) {
      setSessions([]);
      setError(
        err instanceof Error ? err.message : "Unable to load live sessions."
      );
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load({ soft: true });
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const onOpenSession = useCallback((session: LiveSession) => {
    const join = resolveLiveJoin(session);
    if (!join.canJoin) {
      Alert.alert(
        session.title,
        join.reason ?? "Live joining is not available yet."
      );
      return;
    }
    // Reserved: navigate with join.href when a trusted join contract exists.
  }, []);

  if (phase === "loading" && !refreshing) {
    return (
      <View
        style={styles.center}
        accessibilityLabel="Loading live sessions"
        accessibilityRole="progressbar"
      >
        <ActivityIndicator color={colors.accentCyan} size="large" />
        <Text style={styles.muted}>Loading Live…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={phase === "ready" ? sessions : []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <LiveSessionCard session={item} onPress={onOpenSession} />
        )}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Math.max(28, insets.bottom + 16) },
          phase !== "ready" && styles.listFill,
        ]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.accentCyan}
            colors={[colors.accentCyan]}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.heading} accessibilityRole="header">
              Live
            </Text>
            <Text style={styles.subheading}>
              Sessions from trusted UMTUBA live sources appear here.
            </Text>
          </View>
        }
        ListEmptyComponent={
          phase === "unavailable" ? (
            <LiveStatePanel
              variant="unavailable"
              title="Live unavailable"
              body={
                error ??
                "Live lobby listing and joining are not available on this app yet."
              }
              onRetry={() => void load()}
              busy={refreshing}
            />
          ) : phase === "error" ? (
            <LiveStatePanel
              variant="error"
              title="Couldn’t load Live"
              body={error ?? "Unable to load live sessions."}
              onRetry={() => void load()}
              busy={refreshing}
            />
          ) : phase === "empty" ? (
            <LiveStatePanel
              variant="empty"
              title="No live sessions"
              body="There are no scheduled or live sessions right now. Pull to refresh."
              onRetry={() => void load()}
              busy={refreshing}
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  muted: {
    color: colors.textMuted,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  listFill: {
    flexGrow: 1,
  },
  separator: {
    height: 10,
  },
  header: {
    marginBottom: 14,
    gap: 4,
  },
  heading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  subheading: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
