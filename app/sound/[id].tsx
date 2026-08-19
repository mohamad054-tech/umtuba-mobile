import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/lib/auth/AuthContext";
import { useTranslation } from "@/src/lib/i18n";
import {
  fetchSocialSoundById,
  type SocialSound,
} from "@/src/lib/sounds/socialSounds";
import { getSupabase } from "@/src/lib/supabase/client";
import { colors } from "@/src/theme/colors";

export default function SoundPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const soundId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [sound, setSound] = useState<SocialSound | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      if (!soundId) {
        setSound(null);
        setLoading(false);
        return;
      }
      const row = await fetchSocialSoundById(
        getSupabase(),
        soundId,
        user?.id ?? null
      );
      if (!cancelled) {
        setSound(row);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [soundId, user?.id]);

  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.kicker}>{t("sound.title")}</Text>
      {loading ? (
        <ActivityIndicator
          color={colors.accentCyan}
          accessibilityLabel={t("status.loading")}
        />
      ) : sound ? (
        <>
          <Text style={styles.title}>{sound.title || t("sound.original")}</Text>
          <Text style={styles.meta}>{sound.usageCount}</Text>
          <Pressable
            style={styles.cta}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/create",
                params: { sound: sound.id },
              })
            }
            accessibilityRole="button"
            accessibilityLabel={t("sound.useThis")}
          >
            <Text style={styles.ctaText}>{t("sound.useThis")}</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.empty} accessibilityRole="alert">
          {t("sound.unavailable")}
        </Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
  },
  kicker: {
    color: colors.textSubtle,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  meta: {
    color: colors.textMuted,
  },
  empty: {
    color: colors.textMuted,
    lineHeight: 22,
  },
  cta: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  ctaText: {
    color: colors.bg,
    fontWeight: "800",
  },
});
