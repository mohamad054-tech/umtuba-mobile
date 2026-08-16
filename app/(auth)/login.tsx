import { Link, Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
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
import { POST_AUTH_HREF } from "@/src/lib/auth/postAuthDestination";
import { colors } from "@/src/theme/colors";

export default function LoginScreen() {
  const { signIn, session, loading, passwordRecoveryPending } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ error?: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    typeof params.error === "string" && params.error.trim()
      ? params.error
      : null
  );

  if (!loading && session && passwordRecoveryPending) {
    return <Redirect href="/(auth)/update-password" />;
  }

  if (!loading && session) {
    return <Redirect href={POST_AUTH_HREF} />;
  }

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace(POST_AUTH_HREF);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.login.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      title={t("auth.login.title")}
      subtitle={t("auth.login.subtitle")}
      footer={
        <>
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t("auth.login.forgotPassword")}
            >
              <Text style={styles.forgot}>{t("auth.login.forgotPassword")}</Text>
            </Pressable>
          </Link>
          <Link href="/(auth)/signup" asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t("auth.login.createOne")}
            >
              <Text style={styles.link}>
                {t("auth.login.noAccount")}{" "}
                <Text style={styles.linkStrong}>{t("auth.login.createOne")}</Text>
              </Text>
            </Pressable>
          </Link>
        </>
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
      <TextInput
        style={styles.input}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        placeholder={t("auth.login.password")}
        placeholderTextColor={colors.textSubtle}
        value={password}
        onChangeText={setPassword}
        accessibilityLabel={t("auth.login.password")}
      />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Pressable
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={() => void onSubmit()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t("auth.login.submit")}
      >
        {busy ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text style={styles.buttonText}>{t("auth.login.submit")}</Text>
        )}
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
  forgot: {
    color: colors.accentCyan,
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },
  link: {
    color: colors.textMuted,
    fontSize: 14,
  },
  linkStrong: {
    color: colors.accentCyan,
    fontWeight: "700",
  },
});
