import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
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
import { useTranslation } from "@/src/lib/i18n";
import { colors } from "@/src/theme/colors";

export default function LiveScreen() {
  // Unfinished Live join is an App Review risk. Hide the iOS surface; Android unchanged.
  if (Platform.OS === "ios") {
    return <Redirect href="/(tabs)/watch" />;
  }
  return <LiveLobbyScreen />;
}

function LiveLobbyScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [phase, setPhase] = useState<LiveLobbyPhase>("loading");
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    const soft = opts?.soft === true;
    if (!soft) setPhase("loading");
    try {
      const result = await loadLiveLobby();
      if (!result.ok) {
        setSessions([]);
        setPhase(result.unavailable ? "unavailable" : "error");
        return;
      }
      setSessions(result.sessions);
      setPhase(result.sessions.length === 0 ? "empty" : "ready");
    } catch {
      setSessions([]);
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
        join.reason ?? t("live.joinUnavailable")
      );
      return;
    }
    // Reserved: navigate with join.href when a trusted join contract exists.
  }, [t]);

  if (phase === "loading" && !refreshing) {
    return (
      <View
        style={styles.center}
        accessibilityLabel={t("live.loading")}
        accessibilityRole="progressbar"
      >
        <ActivityIndicator color={colors.accentCyan} size="large" />
        <Text style={styles.muted}>{t("live.loading")}</Text>
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
              {t("nav.live")}
            </Text>
            <Text style={styles.subheading}>{t("live.subtitle")}</Text>
          </View>
        }
        ListEmptyComponent={
          phase === "unavailable" ? (
            <LiveStatePanel
              variant="unavailable"
              title={t("live.unavailable")}
              body={t("live.unavailableBody")}
              onRetry={() => void load()}
              busy={refreshing}
            />
          ) : phase === "error" ? (
            <LiveStatePanel
              variant="error"
              title={t("live.loadFailed")}
              body={t("live.loadFailedBody")}
              onRetry={() => void load()}
              busy={refreshing}
            />
          ) : phase === "empty" ? (
            <LiveStatePanel
              variant="empty"
              title={t("live.empty")}
              body={t("live.emptyBody")}
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
