import { Link, Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";

import { AuthScreen } from "@/components/AuthScreen";
import { useTranslation } from "@/src/lib/i18n";
import { normalizeReferralCode } from "@/src/contracts/referral";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { POST_AUTH_HREF } from "@/src/lib/auth/postAuthDestination";
import {
  getReferralAttribution,
  saveReferralAttribution,
} from "@/src/lib/auth/referralAttribution";
import { colors } from "@/src/theme/colors";

export default function SignupScreen() {
  const { signUp, session, loading, passwordRecoveryPending } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string }>();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromParam = normalizeReferralCode(
      typeof params.ref === "string" ? params.ref : null
    );
    if (fromParam) {
      setReferralCode(fromParam);
      void saveReferralAttribution(fromParam);
      return;
    }
    void getReferralAttribution().then(({ code }) => {
      if (code) setReferralCode(code);
    });
  }, [params.ref]);

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
      if (referralCode) {
        await saveReferralAttribution(referralCode);
      }
      await signUp({
        email,
        password,
        fullName,
        username,
        referralCode: referralCode || null,
      });
      router.replace(POST_AUTH_HREF);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("auth.signup.failed")
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      title={t("auth.signup.title")}
      subtitle={t("auth.signup.subtitle")}
      footer={
        <Link href="/(auth)/login" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t("auth.signup.signIn")}
          >
            <Text style={styles.link}>
              {t("auth.signup.haveAccount")}{" "}
              <Text style={styles.linkStrong}>{t("auth.signup.signIn")}</Text>
            </Text>
          </Pressable>
        </Link>
      }
    >
      <TextInput
        style={styles.input}
        placeholder={t("auth.signup.fullName")}
        placeholderTextColor={colors.textSubtle}
        value={fullName}
        onChangeText={setFullName}
        autoComplete="name"
        textContentType="name"
        accessibilityLabel={t("auth.signup.fullName")}
      />
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        placeholder={t("auth.signup.username")}
        placeholderTextColor={colors.textSubtle}
        value={username}
        onChangeText={setUsername}
        autoComplete="username"
        textContentType="username"
        accessibilityLabel={t("auth.signup.username")}
      />
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder={t("auth.signup.email")}
        placeholderTextColor={colors.textSubtle}
        value={email}
        onChangeText={setEmail}
        autoComplete="email"
        textContentType="emailAddress"
        accessibilityLabel={t("auth.signup.email")}
      />
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder={t("auth.signup.password")}
        placeholderTextColor={colors.textSubtle}
        value={password}
        onChangeText={setPassword}
        autoComplete="new-password"
        textContentType="newPassword"
        accessibilityLabel={t("auth.signup.password")}
      />
      <TextInput
        style={styles.input}
        autoCapitalize="characters"
        placeholder={t("auth.signup.referral")}
        placeholderTextColor={colors.textSubtle}
        value={referralCode}
        onChangeText={setReferralCode}
        accessibilityLabel={t("auth.signup.referralA11y")}
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
        accessibilityLabel={t("auth.signup.create")}
      >
        {busy ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text style={styles.buttonText}>{t("auth.signup.create")}</Text>
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
  link: {
    color: colors.textMuted,
    fontSize: 14,
  },
  linkStrong: {
    color: colors.accentCyan,
    fontWeight: "700",
  },
});
