import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useAuth } from "@/src/lib/auth/AuthContext";
import { useTranslation } from "@/src/lib/i18n";
import {
  SOUND_LIBRARY_HEADER_ACTION_MIN_HEIGHT,
  soundLibraryTopInset,
} from "@/src/lib/sounds/soundLibraryEscape";
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

function SoundLibraryBody({
  onClose,
  onSelect,
}: Omit<SoundLibrarySheetProps, "visible">) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [trending, setTrending] = useState<SocialSound[]>([]);
  const [mine, setMine] = useState<SocialSound[]>([]);
  const [saved, setSaved] = useState<SocialSound[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
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
    setLoading(false);
  }, [query, t, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const empty =
    !loading &&
    !error &&
    trending.length === 0 &&
    mine.length === 0 &&
    saved.length === 0;

  const topPad = soundLibraryTopInset(insets.top, Platform.OS);
  const bottomPad = Math.max(insets.bottom, 16);

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

  return (
    <View
      style={[
        styles.root,
        { paddingTop: topPad, paddingBottom: bottomPad },
      ]}
      accessibilityViewIsModal
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("actions.back")}
          style={styles.barBtn}
        >
          <Text style={styles.barBtnText}>{t("actions.back")}</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {t("create.soundLibrary")}
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("actions.close")}
          style={styles.barBtn}
        >
          <Text style={styles.barBtnText}>{t("actions.close")}</Text>
        </Pressable>
      </View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t("create.searchSounds")}
        placeholderTextColor={colors.textSubtle}
        style={styles.input}
        accessibilityLabel={t("create.searchSounds")}
      />
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View style={styles.status}>
            <ActivityIndicator color={colors.accentCyan} />
            <Text style={styles.meta}>{t("status.loading")}</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.status}>
            <Text style={styles.meta}>{error}</Text>
            <Pressable
              onPress={() => void load()}
              accessibilityRole="button"
              accessibilityLabel={t("actions.retry")}
              style={styles.retry}
            >
              <Text style={styles.barBtnText}>{t("actions.retry")}</Text>
            </Pressable>
          </View>
        ) : null}
        {empty ? (
          <Text style={styles.meta}>{t("create.noLicensedSounds")}</Text>
        ) : null}
        {renderSection(t("sound.mySounds"), mine)}
        {renderSection(t("sound.savedSounds"), saved)}
        {renderSection(t("sound.trending"), trending)}
      </ScrollView>
    </View>
  );
}

export function SoundLibrarySheet({
  visible,
  onClose,
  onSelect,
}: SoundLibrarySheetProps) {
  if (!visible) return null;
  return (
    <View
      style={styles.overlay}
      pointerEvents="auto"
      testID="sound-library-overlay"
    >
      <SafeAreaProvider>
        <SoundLibraryBody onClose={onClose} onSelect={onSelect} />
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 80,
    elevation: 80,
    backgroundColor: colors.bg,
  },
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    minHeight: 48,
    gap: 8,
    backgroundColor: colors.bg,
  },
  title: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 16,
    flex: 1,
    flexShrink: 1,
    textAlign: "center",
  },
  barBtn: {
    minHeight: SOUND_LIBRARY_HEADER_ACTION_MIN_HEIGHT,
    minWidth: 64,
    justifyContent: "center",
    paddingHorizontal: 8,
    flexShrink: 0,
  },
  barBtnText: { color: colors.accentCyan, fontWeight: "700" },
  input: {
    margin: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.text,
    minHeight: 48,
  },
  list: { padding: 12, gap: 10, flexGrow: 1 },
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
  status: { gap: 10, marginBottom: 8 },
  retry: {
    alignSelf: "flex-start",
    minHeight: SOUND_LIBRARY_HEADER_ACTION_MIN_HEIGHT,
    justifyContent: "center",
  },
});
