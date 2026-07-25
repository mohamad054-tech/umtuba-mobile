import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/src/theme/colors";

type WorldStatePanelProps = {
  title: string;
  body: string;
  onRetry?: () => void;
  busy?: boolean;
  variant?: "empty" | "unavailable" | "error";
};

export function WorldStatePanel({
  title,
  body,
  onRetry,
  busy = false,
  variant = "unavailable",
}: WorldStatePanelProps) {
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text
        style={styles.title}
        accessibilityRole="header"
        accessibilityLabel={title}
      >
        {title}
      </Text>
      <Text
        style={[styles.body, variant === "error" && styles.bodyError]}
        accessibilityRole={variant === "error" ? "alert" : "text"}
      >
        {body}
      </Text>
      {onRetry ? (
        <Pressable
          style={[styles.retry, busy && styles.retryBusy]}
          onPress={onRetry}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Retry loading World"
          accessibilityState={{ disabled: busy }}
        >
          <Text style={styles.retryText}>{busy ? "Retrying…" : "Retry"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  bodyError: {
    color: colors.danger,
  },
  retry: {
    marginTop: 8,
    minHeight: 44,
    minWidth: 120,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  retryBusy: {
    opacity: 0.55,
  },
  retryText: {
    color: colors.accentCyan,
    fontWeight: "700",
  },
});
