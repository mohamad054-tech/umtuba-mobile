import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useTranslation } from "@/src/lib/i18n";
import { colors } from "@/src/theme/colors";

type LiveStatePanelProps = {
  title: string;
  body: string;
  onRetry?: () => void;
  busy?: boolean;
  variant?: "empty" | "unavailable" | "error";
};

export function LiveStatePanel({
  title,
  body,
  onRetry,
  busy = false,
  variant = "empty",
}: LiveStatePanelProps) {
  const { t } = useTranslation();
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
          style={styles.retry}
          onPress={onRetry}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t("live.retryA11y")}
          accessibilityState={{ disabled: busy }}
        >
          {busy ? (
            <ActivityIndicator color={colors.accentCyan} />
          ) : (
            <Text style={styles.retryText}>{t("actions.retry")}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 24,
    paddingVertical: 32,
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
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    color: colors.accentCyan,
    fontWeight: "700",
  },
});
