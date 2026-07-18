import { Link, Redirect, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";

import { AuthScreen } from "@/components/AuthScreen";
import {
  getErrorMessage,
  isValidEmail,
} from "@/src/contracts/validation";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { getSupabase } from "@/src/lib/supabase/client";
import { colors } from "@/src/theme/colors";

export default function ForgotPasswordScreen() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!loading && session) {
    return <Redirect href="/(tabs)/watch" />;
  }

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      if (!isValidEmail(email)) {
        throw new Error("Please enter a valid email address.");
      }
      const redirectTo = Linking.createURL("auth/update-password");
      const { error: resetError } = await getSupabase().auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo }
      );
      if (resetError) {
        throw new Error(
          getErrorMessage(resetError, "Unable to send reset email.")
        );
      }
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to send reset email."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      title="Reset password"
      subtitle="We'll email you a link to choose a new password."
      footer={
        <Link href="/(auth)/login" asChild>
          <Pressable accessibilityRole="link" accessibilityLabel="Back to sign in">
            <Text style={styles.link}>
              Remembered it? <Text style={styles.linkStrong}>Sign in</Text>
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
        placeholder="Email"
        placeholderTextColor={colors.textSubtle}
        value={email}
        onChangeText={setEmail}
        accessibilityLabel="Email"
      />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {sent ? (
        <Text style={styles.success} accessibilityLiveRegion="polite">
          If an account exists for that email, a reset link is on the way.
        </Text>
      ) : null}
      <Pressable
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={() => void onSubmit()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Send password reset email"
      >
        {busy ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text style={styles.buttonText}>Send reset link</Text>
        )}
      </Pressable>
      <Pressable onPress={() => router.back()} accessibilityRole="button">
        <Text style={styles.back}>Cancel</Text>
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
