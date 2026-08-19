import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/lib/auth/AuthContext";
import { useTranslation } from "@/src/lib/i18n";
import { getSupabase } from "@/src/lib/supabase/client";
import {
  canUseSoundInEditor,
  listOwnedSocialSounds,
  listSavedSocialSounds,
  searchPublicSocialSounds,
  type SocialSound,
} from "@/src/lib/sounds/socialSounds";
import { colors } from "@/src/theme/colors";

type SoundLibrarySheetProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (sound: SocialSound) => void;
};

function usable(
  sounds: SocialSound[],
  viewerUserId: string | null
): SocialSound[] {
  return sounds.filter((sound) =>
    canUseSoundInEditor({
      ...sound,
      viewerUserId,
    })
  );
}

export function SoundLibrarySheet({
  visible,
  onClose,
  onSelect,
}: SoundLibrarySheetProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [trending, setTrending] = useState<SocialSound[]>([]);
  const [mine, setMine] = useState<SocialSound[]>([]);
  const [saved, setSaved] = useState<SocialSound[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const supabase = getSupabase();
    const viewer = user?.id ?? null;
    const publicResult = await searchPublicSocialSounds(supabase, query, 20);
    if (publicResult.unavailable) {
      setTrending([]);
      setError(t("create.soundLibraryUnavailable"));
    } else {
      setTrending(usable(publicResult.sounds, viewer));
    }
    if (viewer) {
      const [owned, favorites] = await Promise.all([
        listOwnedSocialSounds(supabase, viewer),
        listSavedSocialSounds(supabase, viewer),
      ]);
      setMine(usable(owned, viewer));
      setSaved(usable(favorites, viewer));
    } else {
      setMine([]);
      setSaved([]);
    }
  }, [query, t, user?.id]);

  useEffect(() => {
    if (visible) {
      void load();
    }
  }, [load, visible]);

  const renderSection = (label: string, sounds: SocialSound[]) => {
    if (sounds.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{label}</Text>
        {sounds.map((sound) => (
          <Pressable
            key={`${label}-${sound.id}`}
            style={styles.row}
            onPress={() => {
              onSelect(sound);
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel={sound.title}
          >
            <Text style={styles.soundTitle}>{sound.title}</Text>
            <Text style={styles.meta}>
              {sound.usageCount} · {sound.rightsStatus}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  };

  const empty =
    !error && trending.length === 0 && mine.length === 0 && saved.length === 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.topBar}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("actions.close")}
            style={styles.close}
          >
            <Text style={styles.closeText}>{t("actions.close")}</Text>
          </Pressable>
          <Text style={styles.title}>{t("create.soundLibrary")}</Text>
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("create.searchSounds")}
          placeholderTextColor={colors.textSubtle}
          style={styles.input}
          accessibilityLabel={t("create.searchSounds")}
        />
        <ScrollView contentContainerStyle={styles.list}>
          {error ? <Text style={styles.meta}>{error}</Text> : null}
          {empty ? (
            <Text style={styles.meta}>{t("create.noLicensedSounds")}</Text>
          ) : null}
          {renderSection(t("sound.mySounds"), mine)}
          {renderSection(t("sound.savedSounds"), saved)}
          {renderSection(t("sound.trending"), trending)}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  title: { color: colors.text, fontWeight: "800", fontSize: 18 },
  close: { minHeight: 44, justifyContent: "center" },
  closeText: { color: colors.accentCyan, fontWeight: "700" },
  input: {
    margin: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.text,
    minHeight: 48,
  },
  list: { padding: 12, gap: 10 },
  section: { gap: 10, marginBottom: 8 },
  sectionTitle: {
    color: colors.textSubtle,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    minHeight: 56,
  },
  soundTitle: { color: colors.text, fontWeight: "700" },
  meta: { color: colors.textMuted, marginTop: 4 },
});
