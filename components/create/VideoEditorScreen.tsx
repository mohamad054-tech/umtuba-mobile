import { useVideoPlayer, VideoView } from "expo-video";
import { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { VideoOverlayLayer } from "@/components/create/VideoOverlayLayer";
import { localeTextAlign, useTranslation } from "@/src/lib/i18n";
import type { SocialSound } from "@/src/lib/sounds/socialSounds";
import {
  clampTrimWindow,
  type VideoEditState,
} from "@/src/lib/video/videoEditState";
import {
  addOverlay,
  createStickerOverlay,
  createTextOverlay,
  OVERLAY_TEXT_COLORS,
  removeOverlay,
  STICKER_EMOJIS,
  updateOverlay,
} from "@/src/lib/video/videoOverlays";
import { colors } from "@/src/theme/colors";

type VideoEditorScreenProps = {
  visible: boolean;
  uri: string;
  durationMs: number | null;
  draft: VideoEditState;
  selectedSound: SocialSound | null;
  onChange: (next: VideoEditState) => void;
  onClose: () => void;
  onOpenSounds: () => void;
};

export function VideoEditorScreen({
  visible,
  uri,
  durationMs,
  draft,
  selectedSound,
  onChange,
  onClose,
  onOpenSounds,
}: VideoEditorScreenProps) {
  const { t, locale } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState("");
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = draft.mix.originalAudioEnabled === false;
    p.volume = draft.originalAudioVolume;
  });

  const selected = draft.overlays.find((el) => el.id === selectedId) ?? null;
  const durationLabel = useMemo(() => {
    const start = Math.round(draft.trimStartMs / 100) / 10;
    const end = Math.round(draft.trimEndMs / 100) / 10;
    return `${start.toFixed(1)}s – ${end.toFixed(1)}s`;
  }, [draft.trimEndMs, draft.trimStartMs]);

  function commit(next: VideoEditState) {
    onChange(next);
  }

  function askClose() {
    Alert.alert(t("create.editorDiscardTitle"), t("create.editorDiscardBody"), [
      { text: t("create.editorKeep"), style: "cancel" },
      { text: t("create.editorDone"), onPress: onClose },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={askClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.topBar}>
          <Pressable
            onPress={askClose}
            accessibilityRole="button"
            accessibilityLabel={t("actions.back")}
            style={styles.barBtn}
          >
            <Text style={styles.barBtnText}>{t("actions.back")}</Text>
          </Pressable>
          <Text style={styles.title}>{t("create.editorTitle")}</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("create.editorDone")}
            style={styles.barBtn}
          >
            <Text style={styles.barBtnText}>{t("create.editorDone")}</Text>
          </Pressable>
        </View>

        <View
          style={styles.stage}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setStage({ width, height });
          }}
        >
          <VideoView
            player={player}
            style={styles.video}
            nativeControls={false}
            contentFit="contain"
          />
          <VideoOverlayLayer
            elements={draft.overlays}
            width={stage.width}
            height={stage.height}
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.tools}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.section}>{t("create.trim")}</Text>
          <Text style={styles.meta}>{durationLabel}</Text>
          <View style={styles.row}>
            <Pressable
              style={styles.chip}
              onPress={() =>
                commit({
                  ...draft,
                  ...clampTrimWindow(
                    draft.trimStartMs + 500,
                    draft.trimEndMs,
                    durationMs
                  ),
                })
              }
              accessibilityRole="button"
              accessibilityLabel={t("create.trimStart")}
            >
              <Text style={styles.chipText}>{t("create.trimStart")} +0.5s</Text>
            </Pressable>
            <Pressable
              style={styles.chip}
              onPress={() =>
                commit({
                  ...draft,
                  ...clampTrimWindow(
                    draft.trimStartMs,
                    draft.trimEndMs - 500,
                    durationMs
                  ),
                })
              }
              accessibilityRole="button"
              accessibilityLabel={t("create.trimEnd")}
            >
              <Text style={styles.chipText}>{t("create.trimEnd")} −0.5s</Text>
            </Pressable>
          </View>

          <Text style={styles.section}>{t("create.addText")}</Text>
          <TextInput
            value={textDraft}
            onChangeText={setTextDraft}
            placeholder={t("create.textPlaceholder")}
            placeholderTextColor={colors.textSubtle}
            style={[styles.input, { textAlign: localeTextAlign(locale) }]}
            accessibilityLabel={t("create.addText")}
          />
          <View style={styles.row}>
            <Pressable
              style={styles.primary}
              onPress={() => {
                const el = createTextOverlay({
                  text: textDraft || t("create.overlayDefaultText"),
                  y: 0.28,
                });
                commit({ ...draft, overlays: addOverlay(draft.overlays, el) });
                setSelectedId(el.id);
                setTextDraft("");
              }}
              accessibilityRole="button"
              accessibilityLabel={t("create.addText")}
            >
              <Text style={styles.primaryText}>{t("create.addText")}</Text>
            </Pressable>
            {OVERLAY_TEXT_COLORS.slice(0, 6).map((color) => (
              <Pressable
                key={color}
                onPress={() => {
                  if (!selected || selected.kind !== "text") return;
                  commit({
                    ...draft,
                    overlays: updateOverlay(draft.overlays, selected.id, {
                      color,
                    }),
                  });
                }}
                style={[styles.swatch, { backgroundColor: color }]}
                accessibilityRole="button"
                accessibilityLabel={color}
              />
            ))}
          </View>

          <Text style={styles.section}>{t("create.addSticker")}</Text>
          <ScrollView horizontal>
            {STICKER_EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                style={styles.emoji}
                onPress={() => {
                  const el = createStickerOverlay(emoji, { y: 0.62 });
                  commit({ ...draft, overlays: addOverlay(draft.overlays, el) });
                  setSelectedId(el.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={emoji}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {selected ? (
            <View style={styles.row}>
              <Pressable
                style={styles.chip}
                onPress={() =>
                  commit({
                    ...draft,
                    overlays: updateOverlay(draft.overlays, selected.id, {
                      scale: selected.scale + 0.04,
                    }),
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={t("create.resizeLarger")}
              >
                <Text style={styles.chipText}>{t("create.resizeLarger")}</Text>
              </Pressable>
              <Pressable
                style={styles.chip}
                onPress={() =>
                  commit({
                    ...draft,
                    overlays: updateOverlay(draft.overlays, selected.id, {
                      rotation: selected.rotation + 15,
                    }),
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={t("create.rotate")}
              >
                <Text style={styles.chipText}>{t("create.rotate")}</Text>
              </Pressable>
              <Pressable
                style={styles.chip}
                onPress={() => {
                  commit({
                    ...draft,
                    overlays: removeOverlay(draft.overlays, selected.id),
                  });
                  setSelectedId(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={t("create.removeOverlay")}
              >
                <Text style={styles.chipText}>{t("create.removeOverlay")}</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.section}>{t("create.originalAudio")}</Text>
          <View style={styles.row}>
            <Pressable
              style={styles.chip}
              onPress={() => {
                const enabled = !draft.mix.originalAudioEnabled;
                commit({
                  ...draft,
                  originalAudioVolume: enabled ? draft.originalAudioVolume || 1 : 0,
                  mix: { ...draft.mix, originalAudioEnabled: enabled },
                });
              }}
              accessibilityRole="switch"
              accessibilityState={{ checked: draft.mix.originalAudioEnabled }}
              accessibilityLabel={t("create.muteOriginal")}
            >
              <Text style={styles.chipText}>
                {draft.mix.originalAudioEnabled
                  ? t("create.originalAudio")
                  : t("create.muteOriginal")}
              </Text>
            </Pressable>
            {([0.25, 0.5, 1] as const).map((volume) => (
              <Pressable
                key={volume}
                style={styles.chip}
                onPress={() =>
                  commit({
                    ...draft,
                    originalAudioVolume: volume,
                    mix: {
                      ...draft.mix,
                      originalAudioEnabled: true,
                      originalAudioVolume: volume,
                    },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`${Math.round(volume * 100)}%`}
              >
                <Text style={styles.chipText}>{Math.round(volume * 100)}%</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.section}>{t("create.addedSound")}</Text>
          <Text style={styles.meta}>
            {selectedSound
              ? selectedSound.title
              : t("create.noLicensedSounds")}
          </Text>
          <Pressable
            style={styles.primary}
            onPress={onOpenSounds}
            accessibilityRole="button"
            accessibilityLabel={t("create.openSoundLibrary")}
          >
            <Text style={styles.primaryText}>{t("create.openSoundLibrary")}</Text>
          </Pressable>
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
    justifyContent: "space-between",
    paddingHorizontal: 12,
    minHeight: 48,
  },
  title: { color: colors.text, fontWeight: "800", fontSize: 16 },
  barBtn: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  barBtnText: { color: colors.accentCyan, fontWeight: "700" },
  stage: {
    height: 280,
    backgroundColor: "#000",
    marginHorizontal: 12,
    borderRadius: 16,
    overflow: "hidden",
  },
  video: { width: "100%", height: "100%" },
  tools: { padding: 16, gap: 10, paddingBottom: 40 },
  section: {
    color: colors.text,
    fontWeight: "800",
    marginTop: 8,
  },
  meta: { color: colors.textMuted },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 12,
    minHeight: 40,
    justifyContent: "center",
  },
  chipText: { color: colors.text, fontWeight: "600" },
  primary: {
    backgroundColor: colors.text,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  primaryText: { color: colors.bg, fontWeight: "800" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.text,
    minHeight: 48,
  },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  emoji: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  emojiText: { fontSize: 28 },
});
