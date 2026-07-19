import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type AppStateStatus,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  extractHashtags,
  MAX_CAPTION_LENGTH,
  VIDEO_FILE_HINT,
  validateCaption,
} from "@/src/contracts/video";
import { getErrorMessage } from "@/src/contracts/validation";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { getSupabase } from "@/src/lib/supabase/client";
import {
  applyUploadProgress,
  beginUpload,
  canStartUpload,
  completePublish,
  completeUpload,
  failPublish,
  failUpload,
  initialCreateJourneyState,
  retryFromError,
  type CreateJourneyState,
} from "@/src/lib/video/createJourney";
import {
  CREATE_SUCCESS_MESSAGE,
  isAbortError,
} from "@/src/lib/video/createProgress";
import { deleteOwnedVideoObject } from "@/src/lib/video/deleteOwnedVideo";
import {
  clearPendingVideoUpload,
  queuePendingVideoUpload,
} from "@/src/lib/video/orphanUploads";
import {
  pickVideoFromLibrary,
  type PickedVideoAsset,
} from "@/src/lib/video/pickVideo";
import { publishVideoPost } from "@/src/lib/video/publishVideoPost";
import { uploadPostVideo } from "@/src/lib/video/uploadPostVideo";
import { colors } from "@/src/theme/colors";

export default function CreateScreen() {
  const { session, user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [asset, setAsset] = useState<PickedVideoAsset | null>(null);
  const [caption, setCaption] = useState("");
  const [journey, setJourney] = useState<CreateJourneyState>(
    initialCreateJourneyState()
  );
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState
  );
  const abortRef = useRef<AbortController | null>(null);
  const journeyRef = useRef(journey);
  journeyRef.current = journey;

  const hashtags = useMemo(() => extractHashtags(caption), [caption]);
  const busy = journey.uploadBusy || journey.publishBusy;

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      setAppState(next);
    });
    return () => {
      sub.remove();
      abortRef.current?.abort();
    };
  }, []);

  const resetSelection = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setAsset(null);
    setCaption("");
    setJourney(initialCreateJourneyState());
  }, []);

  const onPick = useCallback(async () => {
    if (!canStartUpload(journeyRef.current) || busy) return;
    setJourney((s) => ({ ...s, phase: "picking", error: null, message: null }));
    const result = await pickVideoFromLibrary();
    if (!result.ok) {
      if (result.cancelled) {
        setJourney((s) => ({ ...s, phase: "ready", error: null }));
        return;
      }
      setJourney((s) => ({
        ...s,
        phase: "error",
        error: result.message,
      }));
      return;
    }
    setAsset(result.asset);
    setJourney((s) => ({
      ...s,
      phase: "ready",
      error: null,
      message: null,
      uploadPercent: 0,
      uploadedPath: null,
    }));
  }, [busy]);

  const onCancelUpload = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const runPublishPipeline = useCallback(
    async (picked: PickedVideoAsset, captionText: string) => {
      if (!user || !session) {
        setJourney((s) =>
          failPublish(s, new Error("Please sign in to publish a video."))
        );
        return;
      }

      const started = beginUpload(journeyRef.current);
      if (!started) return;
      setJourney(started);

      const uploadStartedAt = new Date().toISOString();
      const controller = new AbortController();
      abortRef.current = controller;

      let uploadedPath: string | null = null;

      try {
        const {
          data: { session: liveSession },
          error: sessionError,
        } = await getSupabase().auth.getSession();

        if (sessionError || !liveSession?.access_token) {
          throw new Error("Please sign in to upload a video.");
        }

        const uploaded = await uploadPostVideo({
          uri: picked.uri,
          fileName: picked.fileName,
          mimeType: picked.mimeType,
          byteSize: picked.byteSize,
          userId: user.id,
          accessToken: liveSession.access_token,
          signal: controller.signal,
          onProgress: (progress) => {
            setJourney((s) => applyUploadProgress(s, progress.percent));
          },
        });

        uploadedPath = uploaded.path;
        setJourney((s) => completeUpload(s, uploaded.path));

        const {
          data: { user: liveUser },
        } = await getSupabase().auth.getUser();
        if (!liveUser || liveUser.id !== user.id) {
          await queuePendingVideoUpload(uploaded.path);
          throw Object.assign(new Error("Please sign in to publish a video."), {
            code: "auth_required",
          });
        }

        const result = await publishVideoPost(
          getSupabase(),
          user.id,
          {
            full_name: profile?.full_name || profile?.display_name || "UMTUBA User",
            username: profile?.username || `user_${user.id.slice(0, 8)}`,
            avatar_initial: profile?.avatar_initial || "U",
          },
          {
            caption: captionText,
            videoPath: uploaded.path,
            mimeType: uploaded.mimeType,
            byteSize: uploaded.byteSize,
            uploadStartedAt,
            metadata: {
              durationMs: picked.durationMs,
              width: picked.width,
              height: picked.height,
            },
          }
        );

        if (!result.ok) {
          if (result.code === "auth_required" && result.videoPath) {
            await queuePendingVideoUpload(result.videoPath);
          } else if (result.videoPath) {
            await deleteOwnedVideoObject(
              getSupabase(),
              user.id,
              result.videoPath
            );
            await clearPendingVideoUpload(result.videoPath);
          }
          setJourney((s) => failPublish(s, new Error(result.message)));
          return;
        }

        await clearPendingVideoUpload(uploaded.path);
        setJourney((s) => completePublish(s));
      } catch (error) {
        if (isAbortError(error)) {
          if (uploadedPath) {
            await deleteOwnedVideoObject(getSupabase(), user.id, uploadedPath);
            await clearPendingVideoUpload(uploadedPath);
          }
          setJourney((s) => failUpload(s, error));
          return;
        }

        if (
          uploadedPath &&
          error instanceof Error &&
          /sign in/i.test(error.message)
        ) {
          await queuePendingVideoUpload(uploadedPath);
        } else if (uploadedPath) {
          await deleteOwnedVideoObject(getSupabase(), user.id, uploadedPath);
          await clearPendingVideoUpload(uploadedPath);
        }

        setJourney((s) =>
          failUpload(
            s,
            new Error(
              getErrorMessage(
                error,
                "The video could not be uploaded. Please try again."
              )
            )
          )
        );
      } finally {
        abortRef.current = null;
      }
    },
    [profile, session, user]
  );

  const onPublish = useCallback(async () => {
    if (!asset || busy) return;
    const captionCheck = validateCaption(caption);
    if (!captionCheck.ok) {
      setJourney((s) => ({
        ...s,
        phase: "error",
        error: captionCheck.message,
      }));
      return;
    }
    await runPublishPipeline(asset, caption);
  }, [asset, busy, caption, runPublishPipeline]);

  const onRetry = useCallback(() => {
    setJourney((s) => retryFromError(s));
    if (asset) {
      void runPublishPipeline(asset, caption);
    }
  }, [asset, caption, runPublishPipeline]);

  if (authLoading) {
    return (
      <SafeAreaView style={styles.center} edges={["bottom"]}>
        <ActivityIndicator color={colors.accentCyan} />
      </SafeAreaView>
    );
  }

  if (!session || !user) {
    return (
      <SafeAreaView style={styles.center} edges={["bottom"]}>
        <Text style={styles.title}>Sign in to create</Text>
        <Text style={styles.body}>
          Publishing uses your account so videos stay in your folder only.
        </Text>
        <Pressable
          style={styles.primary}
          onPress={() => router.push("/(auth)/login")}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
        >
          <Text style={styles.primaryText}>Sign in</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "android" ? 24 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <Text style={styles.title}>Create</Text>
          <Text style={styles.body}>
            Pick a short video, add a caption, and publish to Watch.
          </Text>
          <Text style={styles.hint}>{VIDEO_FILE_HINT}</Text>

          {appState !== "active" && busy ? (
            <Text
              style={styles.banner}
              accessibilityLiveRegion="polite"
              accessibilityLabel="Upload continues in the background"
            >
              Upload continues while the app is in the background.
            </Text>
          ) : null}

          <Pressable
            style={[styles.secondary, busy && styles.disabled]}
            onPress={() => void onPick()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Choose video from library"
            accessibilityHint="Opens the device media library to choose a video"
            accessibilityState={{ disabled: busy, busy: journey.phase === "picking" }}
          >
            <Text style={styles.secondaryText}>
              {asset ? "Choose a different video" : "Choose video"}
            </Text>
          </Pressable>

          {asset ? (
            <View
              style={styles.card}
              accessibilityLabel={`Selected ${asset.fileName}, ${(asset.byteSize / (1024 * 1024)).toFixed(1)} megabytes`}
            >
              <Text style={styles.cardTitle} numberOfLines={1}>
                {asset.fileName}
              </Text>
              <Text style={styles.cardMeta}>
                {(asset.byteSize / (1024 * 1024)).toFixed(1)} MB
                {asset.durationMs != null
                  ? ` · ${Math.round(asset.durationMs / 1000)}s`
                  : " · duration unavailable"}
                {asset.mimeType ? ` · ${asset.mimeType}` : ""}
              </Text>
              <Pressable
                onPress={resetSelection}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Clear selected video"
                accessibilityState={{ disabled: busy }}
              >
                <Text style={styles.link}>Clear selection</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.empty}>No video selected yet.</Text>
          )}

          <Text style={styles.label}>Caption</Text>
          <TextInput
            style={styles.input}
            value={caption}
            onChangeText={setCaption}
            placeholder="What is this clip about? Use #hashtags if you like."
            placeholderTextColor={colors.textSubtle}
            multiline
            maxLength={MAX_CAPTION_LENGTH}
            editable={!busy}
            accessibilityLabel="Caption"
            accessibilityHint={`Up to ${MAX_CAPTION_LENGTH} characters. Hashtags are optional.`}
            accessibilityState={{ disabled: busy }}
          />
          <Text style={styles.counter}>
            {caption.length}/{MAX_CAPTION_LENGTH}
          </Text>

          {hashtags.length > 0 ? (
            <View style={styles.tags}>
              {hashtags.map((tag) => (
                <Text key={tag} style={styles.tag}>
                  {tag}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={styles.hint}>
              Privacy options are not available yet — published videos follow
              the same public Watch rules as web.
            </Text>
          )}

          {journey.phase === "uploading" ||
          journey.phase === "queued" ||
          journey.phase === "processing" ? (
            <View
              style={styles.progressBlock}
              accessibilityRole="progressbar"
              accessibilityLabel={
                journey.phase === "uploading"
                  ? `Upload progress ${journey.uploadPercent} percent`
                  : "Publishing video"
              }
              accessibilityValue={
                journey.phase === "uploading"
                  ? { min: 0, max: 100, now: journey.uploadPercent }
                  : undefined
              }
              accessibilityLiveRegion="polite"
            >
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width:
                        journey.phase === "uploading"
                          ? `${journey.uploadPercent}%`
                          : "100%",
                      opacity: journey.phase === "uploading" ? 1 : 0.45,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {journey.phase === "uploading"
                  ? `Uploading ${journey.uploadPercent}%`
                  : journey.message || "Publishing…"}
              </Text>
              {journey.phase === "uploading" ? (
                <Pressable
                  style={styles.cancel}
                  onPress={onCancelUpload}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel upload"
                  accessibilityHint="Stops the upload and cleans up"
                >
                  <Text style={styles.cancelText}>Cancel upload</Text>
                </Pressable>
              ) : (
                <ActivityIndicator color={colors.accentCyan} />
              )}
            </View>
          ) : null}

          {journey.phase === "success" ? (
            <View style={styles.success} accessibilityRole="text">
              <Text style={styles.successTitle}>{CREATE_SUCCESS_MESSAGE}</Text>
              <Pressable
                style={styles.primary}
                onPress={() => router.replace("/(tabs)/watch")}
                accessibilityRole="button"
                accessibilityLabel="Open Watch"
              >
                <Text style={styles.primaryText}>Open Watch</Text>
              </Pressable>
              <Pressable
                onPress={resetSelection}
                accessibilityRole="button"
                accessibilityLabel="Create another video"
              >
                <Text style={styles.link}>Create another</Text>
              </Pressable>
            </View>
          ) : null}

          {journey.error ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Text style={styles.errorText}>{journey.error}</Text>
              <View style={styles.row}>
                <Pressable
                  style={styles.secondary}
                  onPress={onRetry}
                  disabled={!asset}
                  accessibilityRole="button"
                  accessibilityLabel="Retry upload and publish"
                  accessibilityState={{ disabled: !asset }}
                >
                  <Text style={styles.secondaryText}>Retry</Text>
                </Pressable>
                <Pressable
                  style={styles.secondary}
                  onPress={() =>
                    setJourney((s) => ({ ...s, error: null, phase: "ready" }))
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss error"
                >
                  <Text style={styles.secondaryText}>Dismiss</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <Pressable
            style={[
              styles.primary,
              (!asset || busy || journey.phase === "success") && styles.disabled,
            ]}
            onPress={() => void onPublish()}
            disabled={!asset || busy || journey.phase === "success"}
            accessibilityRole="button"
            accessibilityLabel="Publish video"
            accessibilityHint="Uploads to your private folder then publishes to Watch"
            accessibilityState={{
              disabled: !asset || busy || journey.phase === "success",
              busy,
            }}
          >
            {busy ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.primaryText}>Publish</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 12,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  body: {
    color: colors.textMuted,
    lineHeight: 22,
  },
  hint: {
    color: colors.textSubtle,
    fontSize: 13,
    lineHeight: 18,
  },
  banner: {
    color: colors.accentCyan,
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 8,
  },
  input: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    textAlignVertical: "top",
    fontSize: 16,
  },
  counter: {
    color: colors.textSubtle,
    fontSize: 12,
    alignSelf: "flex-end",
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  cardTitle: {
    color: colors.text,
    fontWeight: "700",
  },
  cardMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    color: colors.accentCyan,
    fontWeight: "600",
    fontSize: 13,
  },
  primary: {
    marginTop: 8,
    backgroundColor: colors.text,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryText: {
    color: colors.bg,
    fontWeight: "700",
    fontSize: 16,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryText: {
    color: colors.text,
    fontWeight: "600",
  },
  disabled: { opacity: 0.55 },
  link: {
    color: colors.accentCyan,
    fontWeight: "600",
    marginTop: 6,
  },
  progressBlock: {
    gap: 10,
    paddingVertical: 8,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceElevated,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.accentViolet,
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  cancel: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  cancelText: {
    color: colors.danger,
    fontWeight: "700",
  },
  success: {
    gap: 10,
    paddingVertical: 8,
  },
  successTitle: {
    color: colors.success,
    fontWeight: "700",
    fontSize: 16,
  },
  errorBox: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  errorText: {
    color: colors.danger,
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
});
