import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { LiveStatusBadge } from "@/components/live/LiveStatusBadge";
import {
  formatLiveSessionTime,
  resolveLiveJoin,
  type LiveSession,
} from "@/src/lib/live";
import { LIVE_STATUS_KEYS, useTranslation } from "@/src/lib/i18n";
import { colors } from "@/src/theme/colors";

type LiveSessionCardProps = {
  session: LiveSession;
  onPress?: (session: LiveSession) => void;
};

export function LiveSessionCard({ session, onPress }: LiveSessionCardProps) {
  const { t } = useTranslation();
  const join = resolveLiveJoin(session);
  const startLabel = formatLiveSessionTime(session.startsAt);
  const viewerCount = session.viewerCount;
  const viewerAmount =
    viewerCount != null && Number.isFinite(viewerCount) && viewerCount >= 0
      ? Math.trunc(viewerCount) >= 1_000_000
        ? `${(Math.trunc(viewerCount) / 1_000_000).toFixed(1)}M`
        : Math.trunc(viewerCount) >= 1_000
          ? `${(Math.trunc(viewerCount) / 1_000).toFixed(1)}K`
          : String(Math.trunc(viewerCount))
      : null;
  const viewers = viewerAmount
    ? t("live.watching", { values: { count: viewerAmount } })
    : null;
  const statusLabel = t(LIVE_STATUS_KEYS[session.status]);
  const mediaUrl = session.thumbnailUrl || session.avatarUrl;
  const actionable = Boolean(onPress);

  return (
    <Pressable
      style={[styles.card, !actionable && styles.cardStatic]}
      onPress={actionable ? () => onPress?.(session) : undefined}
      disabled={!actionable}
      accessibilityRole={actionable ? "button" : "summary"}
      accessibilityLabel={`${session.title}. ${statusLabel}${session.hostDisplayName ? `. ${t("live.host", { values: { name: session.hostDisplayName } })}` : ""}${viewers ? `. ${viewers}` : ""}`}
      accessibilityHint={
        join.canJoin
          ? t("live.joinHint")
          : join.reason ?? t("live.detailsOnly")
      }
      accessibilityState={{ disabled: !actionable }}
    >
      <View style={styles.media}>
        {mediaUrl ? (
          <Image
            source={{ uri: mediaUrl }}
            style={styles.image}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={styles.mediaFallback}>
            <Text style={styles.mediaFallbackText} accessible={false}>
              ◉
            </Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <LiveStatusBadge status={session.status} />
        <Text style={styles.title} numberOfLines={2}>
          {session.title}
        </Text>
        {session.hostDisplayName ? (
          <Text style={styles.host} numberOfLines={1}>
            {session.hostDisplayName}
          </Text>
        ) : null}
        {session.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {session.description}
          </Text>
        ) : null}
        {startLabel ? (
          <Text style={styles.meta} numberOfLines={1}>
            {session.status === "scheduled"
              ? t("live.starts", { values: { time: startLabel } })
              : startLabel}
          </Text>
        ) : null}
        {viewers && session.status === "live" ? (
          <Text style={styles.meta} numberOfLines={1}>
            {viewers}
          </Text>
        ) : null}

        {join.canJoin ? (
          <Text style={styles.joinHint} numberOfLines={1}>
            {t("live.join")}
          </Text>
        ) : (
          <Text style={styles.disabledHint} numberOfLines={2}>
            {join.reason ?? t("live.joinUnavailable")}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    minHeight: 96,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardStatic: {
    // Keep same chrome; no elevated “button” affordance when not actionable.
  },
  media: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  mediaFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaFallbackText: {
    color: colors.textSubtle,
    fontSize: 22,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  host: {
    color: colors.accentCyan,
    fontSize: 13,
    fontWeight: "600",
  },
  description: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  meta: {
    color: colors.textSubtle,
    fontSize: 12,
  },
  joinHint: {
    marginTop: 4,
    color: colors.accentCyan,
    fontWeight: "800",
    fontSize: 13,
  },
  disabledHint: {
    marginTop: 4,
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 16,
  },
});
