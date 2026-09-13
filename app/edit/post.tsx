import { useVideoPlayer, VideoView } from "expo-video";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MAX_CAPTION_LENGTH } from "@/src/contracts/video";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { createVideoSignedUrl } from "@/src/lib/feed/watchFeed";
import {
  localeTextAlign,
  localeWritingDirection,
  useTranslation,
} from "@/src/lib/i18n";
import {
  coverUrlFromMediaPipeline,
  formatTrimTimestamp,
  normalizeTrimRange,
  playbackEditFromMediaPipeline,
} from "@/src/lib/media/videoTrim";
import {
  loadOwnedPost,
  updatePostForOwner,
  type LoadedOwnedPost,
} from "@/src/lib/social/editOwnedPost";
import { markOwnedPostEdited } from "@/src/lib/social/ownedPostEditSignal";
import { uploadOwnedPostImage } from "@/src/lib/social/uploadPostImage";
import { getSupabase } from "@/src/lib/supabase/client";
import { deleteOwnedVideoObject } from "@/src/lib/video/deleteOwnedVideo";
import { pickVideoFromLibrary } from "@/src/lib/video/pickVideo";
import { uploadPostVideo } from "@/src/lib/video/uploadPostVideo";
import { clampTrimWindow } from "@/src/lib/video/videoEditState";
import { colors } from "@/src/theme/colors";

type PendingVideo = {
  path: string;
  mimeType: string;
  byteSize: number;
  localUri: string;
  durationMs: number | null;
};

export default function EditOwnedPostScreen() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { user, session } = useAuth();
  const params = useLocalSearchParams<{ postId?: string; post?: string }>();
  const postIdRaw = params.postId ?? params.post;
  const postId =
    typeof postIdRaw === "string" && /^\d+$/.test(postIdRaw)
      ? Number(postIdRaw)
      : 0;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [post, setPost] = useState<LoadedOwnedPost | null>(null);
  const [playbackUri, setPlaybackUri] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [articleBody, setArticleBody] = useState("");
  const [removeArticle, setRemoveArticle] = useState(false);
  const [trimIn, setTrimIn] = useState(0);
  const [trimOut, setTrimOut] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [clearCover, setClearCover] = useState(false);
  const [pendingVideo, setPendingVideo] = useState<PendingVideo | null>(null);
  const pendingVideoRef = useRef<PendingVideo | null>(null);
  pendingVideoRef.current = pendingVideo;

  const previewUri = pendingVideo?.localUri || playbackUri || "";
  const previewDuration = pendingVideo?.durationMs ?? durationMs;
  const clamped = clampTrimWindow(trimIn, trimOut, previewDuration || null);
  const player = useVideoPlayer(previewUri, (p) => {
    p.loop = true;
    p.muted = false;
  });

  const textAlign = localeTextAlign(locale);
  const writingDirection = localeWritingDirection(locale);
  const hashtagList = useMemo(
    () =>
      hashtags
        .split(/[\s,]+/)
        .map((tag) => tag.replace(/^#+/, "").trim())
        .filter(Boolean),
    [hashtags]
  );

  useEffect(() => {
    if (!previewUri) return;
    try {
      player.loop = true;
      const startSec = clamped.trimStartMs / 1000;
      if (Number.isFinite(startSec) && startSec > 0.04) {
        player.currentTime = startSec;
      }
      player.play();
    } catch {
      // Preview is best-effort.
    }
  }, [clamped.trimStartMs, player, previewUri]);

  const load = useCallback(async () => {
    if (!user?.id || postId <= 0) {
      setLoading(false);
      setError(t("edit.loadFailed"));
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = getSupabase();
    const row = await loadOwnedPost(supabase, user.id, postId);
    if (!row) {
      setPost(null);
      setError(t("edit.loadFailed"));
      setLoading(false);
      return;
    }
    setPost(row);
    setContent(row.content ?? "");
    setHashtags(
      ((row.content ?? "").match(/#[\p{L}\p{N}_]+/gu) ?? [])
        .map((tag) => tag.slice(1))
        .join(" ")
    );
    const duration = row.media_duration_ms ?? 0;
    setDurationMs(duration);
    const trim =
      playbackEditFromMediaPipeline(row.media_pipeline) ??
      normalizeTrimRange({ inMs: 0, outMs: duration }, duration);
    setTrimIn(trim?.inMs ?? 0);
    setTrimOut(trim?.outMs ?? duration);
    setCoverUrl(coverUrlFromMediaPipeline(row.media_pipeline));
    setClearCover(false);
    setRemoveArticle(false);
    if (row.article_id) {
      const { data } = await supabase
        .from("articles")
        .select("title, body")
        .eq("id", row.article_id)
        .eq("user_id", user.id)
        .maybeSingle();
      setArticleTitle(typeof data?.title === "string" ? data.title : "");
      setArticleBody(typeof data?.body === "string" ? data.body : "");
    } else {
      setArticleTitle("");
      setArticleBody("");
    }
    if (row.video_path) {
      const signed = await createVideoSignedUrl(supabase, row.video_path);
      setPlaybackUri(signed);
    } else {
      setPlaybackUri(null);
    }
    setLoading(false);
  }, [postId, t, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const discardPendingVideo = useCallback(async () => {
    const candidate = pendingVideoRef.current;
    if (!candidate || !user?.id) return;
    await deleteOwnedVideoObject(getSupabase(), user.id, candidate.path);
    setPendingVideo(null);
  }, [user?.id]);

  const onCancel = useCallback(() => {
    void (async () => {
      await discardPendingVideo();
      router.back();
    })();
  }, [discardPendingVideo, router]);

  const onReplaceVideo = useCallback(async () => {
    if (!user?.id) return;
    const picked = await pickVideoFromLibrary();
    if (!picked.ok) {
      if (!picked.cancelled) {
        Alert.alert(t("edit.failed"), picked.message);
      }
      return;
    }
    const {
      data: { session: liveSession },
    } = await getSupabase().auth.getSession();
    const token = liveSession?.access_token || session?.access_token;
    if (!token) {
      Alert.alert(t("edit.failed"), t("create.signInToUpload"));
      return;
    }
    try {
      await discardPendingVideo();
      const uploaded = await uploadPostVideo({
        uri: picked.asset.uri,
        fileName: picked.asset.fileName,
        mimeType: picked.asset.mimeType,
        byteSize: picked.asset.byteSize,
        userId: user.id,
        accessToken: token,
      });
      setPendingVideo({
        path: uploaded.path,
        mimeType: uploaded.mimeType,
        byteSize: uploaded.byteSize,
        localUri: picked.asset.uri,
        durationMs: picked.asset.durationMs,
      });
      const nextDuration = picked.asset.durationMs ?? durationMs;
      if (nextDuration > 0) {
        setDurationMs(nextDuration);
        setTrimIn(0);
        setTrimOut(nextDuration);
      }
    } catch (err) {
      Alert.alert(
        t("edit.failed"),
        err instanceof Error ? err.message : t("edit.livePreserved")
      );
    }
  }, [discardPendingVideo, durationMs, session?.access_token, t, user?.id]);

  const onPickCover = useCallback(async () => {
    if (!user?.id) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    try {
      const url = await uploadOwnedPostImage(getSupabase(), user.id, {
        uri: result.assets[0].uri,
        mimeType: result.assets[0].mimeType,
        fileName: result.assets[0].fileName,
      });
      setCoverUrl(url);
      setClearCover(false);
    } catch (err) {
      Alert.alert(
        t("edit.failed"),
        err instanceof Error ? err.message : t("edit.livePreserved")
      );
    }
  }, [t, user?.id]);

  const onSave = useCallback(async () => {
    if (!user?.id || !post || saving) return;
    setSaving(true);
    setError(null);
    const trim = normalizeTrimRange(
      { inMs: clamped.trimStartMs, outMs: clamped.trimEndMs },
      previewDuration || clamped.trimEndMs
    );
    const result = await updatePostForOwner(getSupabase(), user.id, post.id, {
      content,
      hashtags: hashtagList,
      articleTitle: removeArticle ? null : articleTitle,
      articleBody: removeArticle ? null : articleBody,
      removeArticle,
      trim,
      coverUrl: clearCover ? null : coverUrl,
      clearCover,
      media: pendingVideo
        ? {
            kind: "replace_video",
            candidatePath: pendingVideo.path,
            mimeType: pendingVideo.mimeType,
            byteSize: pendingVideo.byteSize,
            validated: true,
          }
        : { kind: "none" },
    });
    setSaving(false);
    if (!result.ok) {
      setError(`${result.message} ${t("edit.livePreserved")}`);
      return;
    }
    markOwnedPostEdited(result.postId);
    Alert.alert(t("edit.saved"), undefined, [
      { text: t("actions.close"), onPress: () => router.back() },
    ]);
  }, [
    articleBody,
    articleTitle,
    clamped.trimEndMs,
    clamped.trimStartMs,
    clearCover,
    content,
    coverUrl,
    hashtagList,
    pendingVideo,
    post,
    previewDuration,
    removeArticle,
    router,
    saving,
    t,
    user?.id,
  ]);

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={colors.accentCyan} size="large" />
        <Text style={styles.muted}>{t("status.loading")}</Text>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.error}>{error ?? t("edit.loadFailed")}</Text>
        <Pressable onPress={onCancel} accessibilityRole="button">
          <Text style={styles.link}>{t("actions.back")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel={t("actions.cancel")}
            testID="edit-post-cancel"
          >
            <Text style={styles.headerAction}>{t("actions.cancel")}</Text>
          </Pressable>
          <Text style={styles.title}>{t("edit.title")}</Text>
          <Pressable
            onPress={() => void onSave()}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={t("edit.save")}
            testID="edit-post-save"
          >
            <Text style={[styles.headerAction, styles.save]}>
              {saving ? t("edit.saving") : t("edit.save")}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          {previewUri ? (
            <View style={styles.preview}>
              <VideoView
                player={player}
                style={styles.video}
                nativeControls={false}
                contentFit="contain"
              />
            </View>
          ) : null}

          {previewDuration > 0 ? (
            <View>
              <Text style={styles.label}>{t("edit.trim")}</Text>
              <Text style={styles.meta} testID="edit-trim-range">
                {t("edit.trimIn")} {formatTrimTimestamp(clamped.trimStartMs)} ·{" "}
                {t("edit.trimOut")} {formatTrimTimestamp(clamped.trimEndMs)}
              </Text>
              <View style={styles.row}>
                <Pressable
                  style={styles.chip}
                  onPress={() =>
                    setTrimIn((value) =>
                      clampTrimWindow(value + 500, trimOut, previewDuration)
                        .trimStartMs
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t("edit.trimIn")}
                  testID="edit-trim-in"
                >
                  <Text style={styles.chipText}>{t("edit.trimIn")} +0.5s</Text>
                </Pressable>
                <Pressable
                  style={styles.chip}
                  onPress={() =>
                    setTrimOut((value) =>
                      clampTrimWindow(trimIn, value - 500, previewDuration)
                        .trimEndMs
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t("edit.trimOut")}
                  testID="edit-trim-out"
                >
                  <Text style={styles.chipText}>{t("edit.trimOut")} −0.5s</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <Text style={styles.label}>{t("edit.caption")}</Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            style={[styles.input, { textAlign, writingDirection }]}
            multiline
            maxLength={MAX_CAPTION_LENGTH}
            placeholder={t("create.captionPlaceholder")}
            placeholderTextColor={colors.textSubtle}
            accessibilityLabel={t("edit.caption")}
          />

          <Text style={styles.label}>{t("edit.hashtags")}</Text>
          <TextInput
            value={hashtags}
            onChangeText={setHashtags}
            style={[styles.input, { textAlign, writingDirection }]}
            placeholder={t("edit.hashtagsPlaceholder")}
            placeholderTextColor={colors.textSubtle}
            accessibilityLabel={t("edit.hashtags")}
          />

          <Text style={styles.label}>{t("edit.articleTitle")}</Text>
          <TextInput
            value={articleTitle}
            onChangeText={setArticleTitle}
            style={[styles.input, { textAlign, writingDirection }]}
            editable={!removeArticle}
            accessibilityLabel={t("edit.articleTitle")}
          />
          <Text style={styles.label}>{t("edit.articleBody")}</Text>
          <TextInput
            value={articleBody}
            onChangeText={setArticleBody}
            style={[styles.input, styles.article, { textAlign, writingDirection }]}
            multiline
            editable={!removeArticle}
            accessibilityLabel={t("edit.articleBody")}
          />
          <Pressable
            onPress={() => setRemoveArticle((value) => !value)}
            accessibilityRole="button"
            accessibilityState={{ selected: removeArticle }}
          >
            <Text style={styles.link}>
              {removeArticle ? t("actions.dismiss") : t("edit.removeArticle")}
            </Text>
          </Pressable>

          {post.post_type === "video" || post.video_path ? (
            <Pressable
              style={styles.button}
              onPress={() => void onReplaceVideo()}
              accessibilityRole="button"
              testID="edit-replace-video"
            >
              <Text style={styles.buttonText}>{t("edit.replaceVideo")}</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={styles.button}
            onPress={() => void onPickCover()}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>{t("edit.cover")}</Text>
          </Pressable>
          {coverUrl && !clearCover ? (
            <Pressable
              onPress={() => {
                setClearCover(true);
                setCoverUrl(null);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.link}>{t("edit.clearCover")}</Text>
            </Pressable>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.meta}>#{post.id}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
  },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  headerAction: {
    color: colors.textMuted,
    fontWeight: "600",
    minWidth: 72,
  },
  save: {
    color: colors.accentCyan,
    textAlign: "right",
  },
  body: {
    padding: 16,
    gap: 10,
    paddingBottom: 40,
  },
  preview: {
    height: 220,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  video: { flex: 1 },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 6,
  },
  meta: { color: colors.textSubtle, fontSize: 13 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  article: { minHeight: 96, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 8 },
  chip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  chipText: { color: colors.text, fontWeight: "600" },
  button: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  buttonText: { color: colors.text, fontWeight: "700" },
  link: { color: colors.accentCyan, fontWeight: "600" },
  error: { color: colors.danger, lineHeight: 20 },
  muted: { color: colors.textMuted, textAlign: "center", marginTop: 12 },
});
