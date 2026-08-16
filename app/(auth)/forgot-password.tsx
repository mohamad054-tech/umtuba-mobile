import { Link, Redirect } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";

import { AuthScreen } from "@/components/AuthScreen";
import { useGlobalBack } from "@/components/GlobalBackButton";
import { useTranslation } from "@/src/lib/i18n";
import {
  getErrorMessage,
  isValidEmail,
} from "@/src/contracts/validation";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { createAuthRedirectUrl } from "@/src/lib/auth/redirectUrls";
import { getSupabase } from "@/src/lib/supabase/client";
import { colors } from "@/src/theme/colors";

export default function ForgotPasswordScreen() {
  const { session, loading, passwordRecoveryPending } = useAuth();
  const { t } = useTranslation();
  const goBack = useGlobalBack();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!loading && session && passwordRecoveryPending) {
    return <Redirect href="/(auth)/update-password" />;
  }

  if (!loading && session) {
    return <Redirect href="/(tabs)/watch" />;
  }

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      if (!isValidEmail(email)) {
        throw new Error(t("auth.forgot.invalidEmail"));
      }
      const redirectTo = createAuthRedirectUrl();
      const { error: resetError } = await getSupabase().auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo }
      );
      if (resetError) {
        throw new Error(
          getErrorMessage(resetError, t("auth.forgot.failed"))
        );
      }
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("auth.forgot.failed")
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      title={t("auth.forgot.title")}
      subtitle={t("auth.forgot.subtitle")}
      footer={
        <Link href="/(auth)/login" asChild>
          <Pressable accessibilityRole="link" accessibilityLabel={t("auth.forgot.backToSignIn")}>
            <Text style={styles.link}>
              {t("auth.forgot.remembered")}{" "}
              <Text style={styles.linkStrong}>{t("actions.signIn")}</Text>
            </Text>
          </Pressable>
        </Link>
      }
    >
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        placeholder={t("auth.login.email")}
        placeholderTextColor={colors.textSubtle}
        value={email}
        onChangeText={setEmail}
        accessibilityLabel={t("auth.login.email")}
      />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {sent ? (
        <Text style={styles.success} accessibilityLiveRegion="polite">
          {t("auth.forgot.sent")}
        </Text>
      ) : null}
      <Pressable
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={() => void onSubmit()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t("auth.forgot.submit")}
      >
        {busy ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text style={styles.buttonText}>{t("auth.forgot.submit")}</Text>
        )}
      </Pressable>
      <Pressable onPress={goBack} accessibilityRole="button">
        <Text style={styles.back}>{t("actions.cancel")}</Text>
      </Pressable>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
    minHeight: 48,
  },
  button: {
    marginTop: 8,
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    color: colors.bg,
    fontWeight: "700",
    fontSize: 16,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
  success: {
    color: colors.accentCyan,
    fontSize: 14,
    lineHeight: 20,
  },
  link: {
    color: colors.textMuted,
    fontSize: 14,
  },
  linkStrong: {
    color: colors.accentCyan,
    fontWeight: "700",
  },
  back: {
    marginTop: 8,
    textAlign: "center",
    color: colors.textSubtle,
    fontSize: 14,
  },
});
