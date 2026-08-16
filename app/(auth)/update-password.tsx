import { Link, Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";

import { AuthScreen } from "@/components/AuthScreen";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { useTranslation } from "@/src/lib/i18n";
import {
  recoveryFailureMessage,
  updatePasswordWithSession,
} from "@/src/lib/auth/passwordRecovery";
import { getSupabase } from "@/src/lib/supabase/client";
import { colors } from "@/src/theme/colors";

type RecoveryParam = string | string[] | undefined;

function firstParam(value: RecoveryParam): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (Array.isArray(value) && value[0]?.trim()) {
    return value[0]!.trim();
  }
  return null;
}

export default function UpdatePasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ error?: RecoveryParam }>();
  const {
    session,
    loading,
    passwordRecoveryPending,
    clearPasswordRecoveryPending,
    restore,
    signOut,
  } = useAuth();
  const { t } = useTranslation();

  const linkError = useMemo(
    () => firstParam(params.error),
    [params.error]
  );

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(linkError);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (linkError) {
      setError(linkError);
    }
  }, [linkError]);

  const canUpdate = Boolean(session) && passwordRecoveryPending;

  if (!loading && session && !passwordRecoveryPending && !success) {
    return <Redirect href="/(tabs)/watch" />;
  }

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      if (!canUpdate) {
        throw new Error(recoveryFailureMessage("missing"));
      }
      const result = await updatePasswordWithSession(
        getSupabase(),
        password,
        confirmPassword
      );
      if (!result.ok) {
        throw new Error(result.message);
      }

      await restore({ silent: true });
      clearPasswordRecoveryPending();
      try {
        await signOut();
      } catch {
        // Password already updated — still send the user to sign in.
      }
      setSuccess(true);
      router.replace("/(auth)/login");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("auth.update.failed")
      );
    } finally {
      setBusy(false);
    }
  };

  const showMissingSession =
    !loading && !canUpdate && !success;

  return (
    <AuthScreen
      title={t("auth.update.title")}
      subtitle={
        showMissingSession
          ? t("auth.update.missing")
          : t("auth.update.subtitle")
      }
      footer={
        <Link href="/(auth)/forgot-password" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t("auth.update.requestNew")}
          >
            <Text style={styles.link}>
              {t("auth.update.needLink")}{" "}
              <Text style={styles.linkStrong}>{t("auth.update.requestReset")}</Text>
            </Text>
          </Pressable>
        </Link>
      }
    >
      {showMissingSession ? (
        <>
          <Text style={styles.error} accessibilityRole="alert">
            {error ?? recoveryFailureMessage("expired")}
          </Text>
          <Pressable
            style={styles.button}
            onPress={() => router.replace("/(auth)/forgot-password")}
            accessibilityRole="button"
            accessibilityLabel="Request a new password reset"
          >
            <Text style={styles.buttonText}>{t("auth.update.requestNew")}</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace("/(auth)/login")}
            accessibilityRole="button"
          >
            <Text style={styles.back}>{t("auth.forgot.backToSignIn")}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder={t("auth.update.newPassword")}
            placeholderTextColor={colors.textSubtle}
            value={password}
            onChangeText={setPassword}
            editable={!busy && !success}
            accessibilityLabel={t("auth.update.newPassword")}
          />
          <TextInput
            style={styles.input}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder={t("auth.update.confirmPassword")}
            placeholderTextColor={colors.textSubtle}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            editable={!busy && !success}
            accessibilityLabel={t("auth.update.confirmPassword")}
          />
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          {success ? (
            <Text style={styles.success} accessibilityLiveRegion="polite">
              {t("auth.update.success")}
            </Text>
          ) : null}
          <Pressable
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={() => void onSubmit()}
            disabled={busy || success || !canUpdate}
            accessibilityRole="button"
            accessibilityLabel={t("auth.update.submit")}
          >
            {busy ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.buttonText}>{t("auth.update.submit")}</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.replace("/(auth)/login")}
            accessibilityRole="button"
          >
            <Text style={styles.back}>{t("actions.cancel")}</Text>
          </Pressable>
        </>
      )}
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
    lineHeight: 20,
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
