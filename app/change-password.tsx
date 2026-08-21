import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PasswordField } from "@/components/auth/PasswordField";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { useTranslation } from "@/src/lib/i18n";
import { updatePasswordWithSession } from "@/src/lib/auth/passwordRecovery";
import { getSupabase } from "@/src/lib/supabase/client";
import { colors } from "@/src/theme/colors";

/**
 * Authenticated password change (session required).
 * Reuses the same updateUser path as recovery, without recovery-pending gate.
 */
export default function ChangePasswordScreen() {
  const { user, session } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!user || !session) {
    return (
      <SafeAreaView style={styles.root} edges={["bottom"]}>
        <View style={styles.center}>
          <Text style={styles.title}>{t("auth.required.title")}</Text>
          <Text style={styles.muted}>
            {t("auth.change.signInBody")}
          </Text>
          <Pressable
            style={styles.primary}
            onPress={() => router.replace("/(auth)/login")}
            accessibilityRole="button"
            accessibilityLabel={t("actions.signIn")}
          >
            <Text style={styles.primaryText}>{t("actions.signIn")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await updatePasswordWithSession(
        getSupabase(),
        password,
        confirmPassword
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("auth.update.failed")
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          {t("auth.change.title")}
        </Text>
        <Text style={styles.muted}>
          {t("auth.change.subtitle")}
        </Text>

        <Text style={styles.label}>{t("auth.update.newPassword")}</Text>
        <PasswordField
          purpose="new"
          value={password}
          onChangeText={setPassword}
          placeholder={t("auth.update.newPassword")}
          accessibilityLabel={t("auth.update.newPassword")}
          editable={!busy}
          containerStyle={styles.passwordField}
          testID="change-password"
        />

        <Text style={styles.label}>{t("auth.update.confirmPassword")}</Text>
        <PasswordField
          purpose="new"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder={t("auth.update.confirmPassword")}
          accessibilityLabel={t("auth.update.confirmPassword")}
          editable={!busy}
          containerStyle={styles.passwordField}
          testID="change-password-confirm"
        />

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        {success ? (
          <Text style={styles.success} accessibilityRole="text">
            {t("auth.change.success")}
          </Text>
        ) : null}

        <Pressable
          style={[styles.primary, busy && styles.primaryDisabled]}
          onPress={() => void onSubmit()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t("auth.change.save")}
        >
          {busy ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.primaryText}>{t("auth.change.save")}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  muted: {
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 20,
  },
  label: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  passwordField: {
    marginBottom: 14,
  },
  error: {
    color: colors.danger,
    marginBottom: 12,
  },
  success: {
    color: colors.success,
    marginBottom: 12,
    fontWeight: "600",
  },
  primary: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.accentViolet,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryDisabled: {
    opacity: 0.7,
  },
  primaryText: {
    color: colors.text,
    fontWeight: "700",
  },
});
