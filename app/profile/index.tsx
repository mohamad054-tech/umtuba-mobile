import { Link, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/src/lib/auth/AuthContext";
import { colors } from "@/src/theme/colors";

export default function ProfileScreen() {
  const { profile, user, signOut } = useAuth();
  const router = useRouter();

  const onSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  return (
    <View style={styles.root}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {profile?.avatar_initial || "U"}
        </Text>
      </View>
      <Text style={styles.name}>
        {profile?.display_name || "UMTUBA User"}
      </Text>
      <Text style={styles.username}>
        @{profile?.username || "user"}
      </Text>
      {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      <Text style={styles.meta}>{user?.email}</Text>

      <View style={styles.links}>
        <Link href="/rewards" asChild>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkText}>Rewards</Text>
          </Pressable>
        </Link>
        <Link href="/notifications" asChild>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkText}>Notifications</Text>
          </Pressable>
        </Link>
        <Link href="/settings" asChild>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkText}>Settings</Text>
          </Pressable>
        </Link>
      </View>

      <Pressable style={styles.signOut} onPress={() => void onSignOut()}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
  },
  username: {
    color: colors.accentCyan,
    marginTop: 4,
    marginBottom: 12,
  },
  bio: {
    color: colors.textMuted,
    marginBottom: 8,
    lineHeight: 20,
  },
  meta: {
    color: colors.textSubtle,
    fontSize: 13,
    marginBottom: 24,
  },
  links: {
    gap: 10,
    marginBottom: 28,
  },
  linkRow: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  linkText: {
    color: colors.text,
    fontWeight: "600",
  },
  signOut: {
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  signOutText: {
    color: colors.danger,
    fontWeight: "700",
  },
});
