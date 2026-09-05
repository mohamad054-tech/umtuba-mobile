import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { SoundLibrarySheet } from "@/components/create/SoundLibrarySheet";
import { VideoOverlayLayer } from "@/components/create/VideoOverlayLayer";
import { VideoTrimTimeline } from "@/components/create/VideoTrimTimeline";
import { SelectedSoundPlayer } from "@/components/sounds/SelectedSoundPlayer";
import {
  localeTextAlign,
  localeWritingDirection,
  useTranslation,
} from "@/src/lib/i18n";
import {
  resolveEditorAddedSoundAudio,
  resolveEditorOriginalAudio,
  resolveSocialSoundPlaybackUri,
} from "@/src/lib/sounds/socialSoundPlayback";
import { shouldInterceptEditorBackForSoundLibrary } from "@/src/lib/sounds/soundLibraryEscape";
import type { SocialSound } from "@/src/lib/sounds/socialSounds";
import { getSupabase } from "@/src/lib/supabase/client";
import {
  applyPlaybackIntent,
  isPlayerAlive,
} from "@/src/lib/watch/playerSession";
import {
  createEditorExitGuard,
  EDITOR_FOOTER_CTA_MIN_HEIGHT,
  EDITOR_HEADER_ACTION_MIN_HEIGHT,
  editorFooterPaddingBottom,
} from "@/src/lib/video/editorExit";
import {
  commitEditorTextOnDismiss,
  EDITOR_TEXT_INPUT_ACCESSORY_ID,
} from "@/src/lib/video/editorKeyboard";
import { OVERLAY_INTERACTION_LAYOUT_DIRECTION } from "@/src/lib/video/overlayDrag";
import {
  applyTrimEnvelope,
  clearAddedSound,
  type VideoEditState,
} from "@/src/lib/video/videoEditState";
import {
  deleteKeepSegment,
  popEditUndo,
  pushEditUndo,
  splitKeepSegmentAt,
  type VideoKeepSegment,
} from "@/src/lib/video/videoSegments";
import {
  addOverlay,
  createStickerOverlay,
  createTextOverlay,
  moveOverlay,
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
  soundLibraryOpen: boolean;
  onChange: (next: VideoEditState) => void;
  onClose: () => void;
  onOpenSounds: () => void;
  onCloseSounds: () => void;
  onSelectSound: (sound: SocialSound) => void;
  onClearSound?: () => void;
  mode?: "create" | "published";
  onSave?: () => void;
  saving?: boolean;
};

export function VideoEditorScreen({
  visible,
  uri,
  durationMs,
  draft,
  selectedSound,
  soundLibraryOpen,
  onChange,
  onClose,
  onOpenSounds,
  onCloseSounds,
  onSelectSound,
  onClearSound,
  mode = "create",
  onSave,
  saving = false,
}: VideoEditorScreenProps) {
  const { t, locale } = useTranslation();
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState("");
  const [textFocused, setTextFocused] = useState(false);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [closing, setClosing] = useState(false);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(
    null
  );
  const undoRef = useRef<VideoKeepSegment[][]>([]);
  const exitGuard = useRef(createEditorExitGuard()).current;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const textInputRef = useRef<TextInput>(null);
  const [selectedSoundUri, setSelectedSoundUri] = useState<string | null>(null);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = draft.mix.originalAudioEnabled === false;
    p.volume = draft.originalAudioVolume;
    p.audioMixingMode = "mixWithOthers";
  });
  const originalAudio = resolveEditorOriginalAudio(draft.mix);
  const addedSoundAudio = resolveEditorAddedSoundAudio(draft.mix);

  const selected = draft.overlays.find((el) => el.id === selectedId) ?? null;
  const durationLabel = useMemo(() => {
    const start = Math.round(draft.trimStartMs / 100) / 10;
    const end = Math.round(draft.trimEndMs / 100) / 10;
    return `${start.toFixed(1)}s – ${end.toFixed(1)}s`;
  }, [draft.trimEndMs, draft.trimStartMs]);

  useEffect(() => {
    if (visible) {
      exitGuard.reset();
      setClosing(false);
    }
  }, [visible, exitGuard]);

  useEffect(() => {
    const current = draftRef.current.overlays.find((el) => el.id === selectedId);
    if (current?.kind === "text") {
      setTextDraft(current.text ?? "");
    }
  }, [selectedId]);

  useEffect(() => {
    let cancelled = false;
    const storagePath = selectedSound?.storagePath ?? null;
    if (!storagePath) {
      setSelectedSoundUri(null);
      return;
    }
    void resolveSocialSoundPlaybackUri(getSupabase(), selectedSound).then(
      (nextUri) => {
        if (!cancelled) setSelectedSoundUri(nextUri);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [selectedSound]);

  useEffect(() => {
    if (!isPlayerAlive(player)) return;
    try {
      player.audioMixingMode = "mixWithOthers";
    } catch {
      return;
    }
    if (!visible) {
      applyPlaybackIntent(player, {
        shouldPlay: false,
        muted: true,
        volume: 0,
        loop: false,
        resetPosition: false,
      });
      return;
    }
    applyPlaybackIntent(player, {
      shouldPlay: true,
      muted: originalAudio.muted,
      volume: originalAudio.volume,
      loop: true,
      resetPosition: false,
    });
  }, [originalAudio.muted, originalAudio.volume, player, visible]);

  function seekPreview(ms: number) {
    setPlayheadMs(ms);
    if (!isPlayerAlive(player)) return;
    try {
      player.currentTime = Math.max(0, ms / 1000);
    } catch {
      // Preview seek is best-effort.
    }
  }

  function commit(next: VideoEditState) {
    onChange(next);
  }

  function commitSegments(nextSegments: VideoKeepSegment[]) {
    undoRef.current = pushEditUndo(undoRef.current, draft.segments);
    const envelope = nextSegments[0]
      ? {
          trimStartMs: nextSegments[0].startMs,
          trimEndMs: nextSegments[nextSegments.length - 1]!.endMs,
        }
      : { trimStartMs: draft.trimStartMs, trimEndMs: draft.trimEndMs };
    commit({
      ...draft,
      segments: nextSegments,
      trimStartMs: envelope.trimStartMs,
      trimEndMs: envelope.trimEndMs,
    });
  }

  function commitAndContinue() {
    if (!exitGuard.requestContinue()) return;
    setClosing(true);
    onChange(draftRef.current);
    onClose();
  }

  function finishTextEdit() {
    const result = commitEditorTextOnDismiss({
      textDraft,
      selected,
      overlays: draftRef.current.overlays,
    });
    commit({
      ...draftRef.current,
      overlays: result.overlays,
    });
    setSelectedId(result.selectedId);
    setTextDraft(result.textDraft);
    setTextFocused(false);
    textInputRef.current?.blur();
    Keyboard.dismiss();
  }

  function discardPublished() {
    onClose();
  }

  function askClose() {
    if (mode === "published") {
      Alert.alert(
        t("create.editorDiscardTitle"),
        t("create.editorDiscardPublishedBody"),
        [
          { text: t("create.editorKeep"), style: "cancel" },
          { text: t("actions.cancel"), style: "destructive", onPress: discardPublished },
        ]
      );
      return;
    }
    Alert.alert(t("create.editorDiscardTitle"), t("create.editorDiscardBody"), [
      { text: t("create.editorKeep"), style: "cancel" },
      { text: t("create.editorDone"), onPress: commitAndContinue },
    ]);
  }

  function requestModalClose() {
    if (shouldInterceptEditorBackForSoundLibrary(soundLibraryOpen)) {
      onCloseSounds();
      return;
    }
    askClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={requestModalClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
          <View style={styles.topBar}>
            <Pressable
              onPress={askClose}
              accessibilityRole="button"
              accessibilityLabel={t("actions.back")}
              style={styles.barBtn}
            >
              <Text style={styles.barBtnText}>{t("actions.back")}</Text>
            </Pressable>
            <Text style={styles.title} numberOfLines={1}>
              {t("create.editorTitle")}
            </Text>
            <Pressable
              onPress={mode === "published" ? discardPublished : commitAndContinue}
              disabled={closing || saving}
              accessibilityRole="button"
              accessibilityLabel={
                mode === "published" ? t("actions.cancel") : t("create.editorDone")
              }
              accessibilityState={{ disabled: closing || saving }}
              style={styles.barBtn}
            >
              <Text style={styles.barBtnText}>
                {mode === "published" ? t("actions.cancel") : t("create.editorDone")}
              </Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.stage,
              { direction: OVERLAY_INTERACTION_LAYOUT_DIRECTION },
            ]}
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
              pointerEvents="none"
            />
            {selectedSoundUri ? (
              <SelectedSoundPlayer
                uri={selectedSoundUri}
                shouldPlay={visible}
                muted={addedSoundAudio.muted}
                volume={addedSoundAudio.volume}
                loop
                startOffsetMs={draft.mix.soundStartOffsetMs}
              />
            ) : null}
            <VideoOverlayLayer
              elements={draft.overlays}
              width={stage.width}
              height={stage.height}
              editable
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={(id, x, y) =>
                commit({
                  ...draftRef.current,
                  overlays: moveOverlay(draftRef.current.overlays, id, x, y),
                })
              }
            />
          </View>

          <ScrollView
            style={styles.toolsScroll}
            contentContainerStyle={styles.tools}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <Text style={styles.section}>{t("create.trim")}</Text>
            <Text style={styles.meta}>{durationLabel}</Text>
            <VideoTrimTimeline
              durationMs={durationMs ?? 0}
              inMs={draft.trimStartMs}
              outMs={draft.trimEndMs}
              playheadMs={playheadMs}
              segments={draft.segments}
              selectedSegmentIndex={selectedSegmentIndex}
              onTrimChange={({ inMs, outMs }) => {
                commit(applyTrimEnvelope(draft, inMs, outMs, durationMs));
              }}
              onPlayheadChange={seekPreview}
              onSelectSegment={setSelectedSegmentIndex}
              startLabel={t("create.trimStart")}
              endLabel={t("create.trimEnd")}
              durationLabel={t("create.trimDuration")}
            />
            <View style={styles.row}>
              <Pressable
                style={styles.chip}
                onPress={() => {
                  const next = splitKeepSegmentAt(
                    draft.segments,
                    playheadMs,
                    durationMs ?? 0
                  );
                  if (!next) return;
                  commitSegments(next);
                }}
                accessibilityRole="button"
                accessibilityLabel={t("create.split")}
              >
                <Text style={styles.chipText}>{t("create.split")}</Text>
              </Pressable>
              <Pressable
                style={styles.chip}
                onPress={() => {
                  if (selectedSegmentIndex == null) return;
                  const next = deleteKeepSegment(
                    draft.segments,
                    selectedSegmentIndex
                  );
                  if (!next) return;
                  commitSegments(next);
                  setSelectedSegmentIndex(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={t("create.deleteSegment")}
              >
                <Text style={styles.chipText}>{t("create.deleteSegment")}</Text>
              </Pressable>
              <Pressable
                style={styles.chip}
                onPress={() => {
                  const undo = popEditUndo(undoRef.current);
                  undoRef.current = undo.nextHistory;
                  if (!undo.previous) return;
                  commit({
                    ...draft,
                    segments: undo.previous,
                    trimStartMs: undo.previous[0]?.startMs ?? draft.trimStartMs,
                    trimEndMs:
                      undo.previous[undo.previous.length - 1]?.endMs ??
                      draft.trimEndMs,
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel={t("create.undo")}
              >
                <Text style={styles.chipText}>{t("create.undo")}</Text>
              </Pressable>
              <Pressable
                style={styles.chip}
                onPress={() =>
                  commit(
                    applyTrimEnvelope(
                      draft,
                      draft.trimStartMs + 500,
                      draft.trimEndMs,
                      durationMs
                    )
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={t("create.trimStart")}
              >
                <Text style={styles.chipText}>{t("create.trimStart")} +0.5s</Text>
              </Pressable>
              <Pressable
                style={styles.chip}
                onPress={() =>
                  commit(
                    applyTrimEnvelope(
                      draft,
                      draft.trimStartMs,
                      draft.trimEndMs - 500,
                      durationMs
                    )
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={t("create.trimEnd")}
              >
                <Text style={styles.chipText}>{t("create.trimEnd")} −0.5s</Text>
              </Pressable>
            </View>

            <Text style={styles.section}>{t("create.addText")}</Text>
            <TextInput
              ref={textInputRef}
              value={textDraft}
              onChangeText={setTextDraft}
              placeholder={t("create.textPlaceholder")}
              placeholderTextColor={colors.textSubtle}
              style={[
                styles.input,
                {
                  textAlign: localeTextAlign(locale),
                  writingDirection: localeWritingDirection(locale),
                },
              ]}
              accessibilityLabel={t("create.addText")}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={finishTextEdit}
              onFocus={() => setTextFocused(true)}
              onBlur={() => setTextFocused(false)}
              inputAccessoryViewID={
                Platform.OS === "ios" ? EDITOR_TEXT_INPUT_ACCESSORY_ID : undefined
              }
            />
            <Pressable
              style={[styles.localDone, textFocused && styles.localDoneActive]}
              onPress={finishTextEdit}
              accessibilityRole="button"
              accessibilityLabel={t("create.editorTextDone")}
              accessibilityHint={t("create.editorTextDoneHint")}
            >
              <Text style={styles.localDoneText}>{t("create.editorTextDone")}</Text>
            </Pressable>
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
                  textInputRef.current?.blur();
                  Keyboard.dismiss();
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
            <View style={styles.row}>
              <Pressable
                style={styles.primary}
                onPress={onOpenSounds}
                accessibilityRole="button"
                accessibilityLabel={t("create.openSoundLibrary")}
              >
                <Text style={styles.primaryText}>{t("create.openSoundLibrary")}</Text>
              </Pressable>
              {draft.soundId ? (
                <Pressable
                  style={styles.chip}
                  onPress={() => {
                    commit(clearAddedSound(draft));
                    onClearSound?.();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t("create.removeSound")}
                >
                  <Text style={styles.chipText}>{t("create.removeSound")}</Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>

          <View
            style={[
              styles.footer,
              { paddingBottom: editorFooterPaddingBottom(insets.bottom) },
            ]}
          >
            <Pressable
              onPress={() => {
                if (mode === "published") {
                  onSave?.();
                  return;
                }
                commitAndContinue();
              }}
              disabled={closing || saving}
              accessibilityRole="button"
              accessibilityLabel={
                mode === "published"
                  ? t("actions.save")
                  : t("create.editorContinue")
              }
              accessibilityHint={
                mode === "published"
                  ? t("create.editorSaveHint")
                  : t("create.editorContinueHint")
              }
              accessibilityState={{ disabled: closing || saving, busy: closing || saving }}
              style={[styles.footerCta, (closing || saving) && styles.footerCtaDisabled]}
            >
              <Text style={styles.footerCtaText} numberOfLines={2}>
                {mode === "published"
                  ? t("actions.save")
                  : t("create.editorContinue")}
              </Text>
            </Pressable>
          </View>
          {Platform.OS === "ios" ? (
            <InputAccessoryView nativeID={EDITOR_TEXT_INPUT_ACCESSORY_ID}>
              <View style={styles.accessory}>
                <Pressable
                  onPress={finishTextEdit}
                  accessibilityRole="button"
                  accessibilityLabel={t("create.editorTextDone")}
                  accessibilityHint={t("create.editorTextDoneHint")}
                  style={styles.accessoryBtn}
                >
                  <Text style={styles.accessoryBtnText}>
                    {t("create.editorTextDone")}
                  </Text>
                </Pressable>
              </View>
            </InputAccessoryView>
          ) : null}
        </SafeAreaView>
        <SoundLibrarySheet
          visible={soundLibraryOpen}
          onClose={onCloseSounds}
          onSelect={onSelectSound}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    minHeight: 48,
    gap: 8,
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
    minHeight: EDITOR_HEADER_ACTION_MIN_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: 8,
    flexShrink: 0,
  },
  barBtnText: { color: colors.accentCyan, fontWeight: "700" },
  stage: {
    height: 280,
    backgroundColor: "#000",
    marginHorizontal: 12,
    borderRadius: 16,
    overflow: "hidden",
  },
  video: { width: "100%", height: "100%" },
  toolsScroll: { flex: 1 },
  tools: { padding: 16, gap: 10, paddingBottom: 16 },
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
  localDone: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentCyan,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  localDoneActive: { opacity: 1 },
  localDoneText: { color: colors.bg, fontWeight: "800" },
  accessory: {
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "flex-end",
  },
  accessoryBtn: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  accessoryBtnText: { color: colors.accentCyan, fontWeight: "800", fontSize: 17 },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  emoji: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  emojiText: { fontSize: 28 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.bg,
  },
  footerCta: {
    backgroundColor: colors.text,
    borderRadius: 14,
    minHeight: EDITOR_FOOTER_CTA_MIN_HEIGHT,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  footerCtaDisabled: { opacity: 0.55 },
  footerCtaText: {
    color: colors.bg,
    fontWeight: "800",
    fontSize: 17,
    textAlign: "center",
  },
});
