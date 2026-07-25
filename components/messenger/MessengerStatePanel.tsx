import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/src/theme/colors";

type MessengerStatePanelProps = {
  title: string;
  body: string;
  onRetry?: () => void;
  busy?: boolean;
  variant?: "empty" | "unavailable" | "error";
};

export function MessengerStatePanel({
  title,
  body,
  onRetry,
  busy = false,
  variant = "empty",
}: MessengerStatePanelProps) {
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.title} accessibilityRole="header">
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
          style={styles.retry}
          onPress={onRetry}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          accessibilityState={{ disabled: busy }}
        >
          {busy ? (
            <ActivityIndicator color={colors.accentCyan} />
          ) : (
            <Text style={styles.retryText}>Retry</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 28,
    paddingVertical: 40,
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
    minHeight: 48,
    minWidth: 120,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    color: colors.accentCyan,
    fontWeight: "700",
  },
});
