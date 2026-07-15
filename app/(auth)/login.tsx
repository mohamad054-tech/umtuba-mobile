import { Link, Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AuthScreen } from "@/components/AuthScreen";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { colors } from "@/src/theme/colors";

export default function LoginScreen() {
  const { signIn, session, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && session) {
    return <Redirect href="/(tabs)/watch" />;
  }

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace("/(tabs)/watch");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Sign in to Watch, earn UM Points, and continue your journey."
      footer={
        <Link href="/(auth)/signup" asChild>
          <Pressable>
            <Text style={styles.link}>
              New here? <Text style={styles.linkStrong}>Create an account</Text>
            </Text>
          </Pressable>
        </Link>
      }
    >
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor={colors.textSubtle}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="Password"
        placeholderTextColor={colors.textSubtle}
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={() => void onSubmit()}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text style={styles.buttonText}>Sign in</Text>
        )}
      </Pressable>
      <View />
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
  },
  button: {
    marginTop: 8,
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
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
