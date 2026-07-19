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
        err instanceof Error ? err.message : "Unable to update password."
      );
    } finally {
      setBusy(false);
    }
  };

  const showMissingSession =
    !loading && !canUpdate && !success;

  return (
    <AuthScreen
      title="Choose a new password"
      subtitle={
        showMissingSession
          ? "This reset link is missing, invalid, or expired."
          : "Enter a new password for your UMTUBA account."
      }
      footer={
        <Link href="/(auth)/forgot-password" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Request a new reset link"
          >
            <Text style={styles.link}>
              Need a new link?{" "}
              <Text style={styles.linkStrong}>Request reset</Text>
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
            <Text style={styles.buttonText}>Request a new link</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace("/(auth)/login")}
            accessibilityRole="button"
          >
            <Text style={styles.back}>Back to sign in</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder="New password"
            placeholderTextColor={colors.textSubtle}
            value={password}
            onChangeText={setPassword}
            editable={!busy && !success}
            accessibilityLabel="New password"
          />
          <TextInput
            style={styles.input}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder="Confirm new password"
            placeholderTextColor={colors.textSubtle}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            editable={!busy && !success}
            accessibilityLabel="Confirm new password"
          />
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          {success ? (
            <Text style={styles.success} accessibilityLiveRegion="polite">
              Password updated. Sign in with your new password.
            </Text>
          ) : null}
          <Pressable
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={() => void onSubmit()}
            disabled={busy || success || !canUpdate}
            accessibilityRole="button"
            accessibilityLabel="Update password"
          >
            {busy ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.buttonText}>Update password</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.replace("/(auth)/login")}
            accessibilityRole="button"
          >
            <Text style={styles.back}>Cancel</Text>
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
