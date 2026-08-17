import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Linking,
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
  validateCaption,
} from "@/src/contracts/video";
import { getErrorMessage } from "@/src/contracts/validation";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { useTranslation } from "@/src/lib/i18n";
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
  openWatchAfterPublishHref,
  retryFromError,
  type CreateJourneyState,
} from "@/src/lib/video/createJourney";
import {
  applyAcceptedPick,
  applyRejectedPick,
  bindRetryToCurrentAsset,
  canPublishCreateDraft,
  evaluateCreateAsset,
  isStaleCreateAttempt,
  nextCreateAttemptId,
  resetCreateDraftAfterPublish,
  shouldResetCreateOnBlur,
} from "@/src/lib/video/createUploadState";
import { isAbortError } from "@/src/lib/video/createProgress";
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
import { UGC_TERMS_URL, canPublishWithUgcAck } from "@/src/lib/video/ugcSafety";
import { colors } from "@/src/theme/colors";

export default function CreateScreen() {
  const { session, user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [asset, setAsset] = useState<PickedVideoAsset | null>(null);
  const [caption, setCaption] = useState("");
  const [journey, setJourney] = useState<CreateJourneyState>(
    initialCreateJourneyState()
  );
  const [ugcAck, setUgcAck] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState
  );
  const abortRef = useRef<AbortController | null>(null);
  const journeyRef = useRef(journey);
  journeyRef.current = journey;
  const attemptNonceRef = useRef(0);
  const activeAttemptRef = useRef<string | null>(null);

  const hashtags = useMemo(() => extractHashtags(caption), [caption]);
  const busy = journey.uploadBusy || journey.publishBusy;
  const publishable = canPublishCreateDraft({
    asset,
    journey,
    ugcAck,
    caption,
  });

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
    attemptNonceRef.current += 1;
    activeAttemptRef.current = null;
    setAsset(null);
    setCaption("");
    setUgcAck(false);
    setJourney(initialCreateJourneyState());
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (shouldResetCreateOnBlur(journeyRef.current.phase)) {
          resetSelection();
        }
      };
    }, [resetSelection])
  );

  const onPick = useCallback(async () => {
    if (!canStartUpload(journeyRef.current) || busy) return;
    setJourney((s) => ({ ...s, phase: "picking", error: null, message: null }));
    const result = await pickVideoFromLibrary();
    if (!result.ok) {
      if (result.cancelled) {
        setJourney((s) => ({ ...s, phase: "ready", error: null }));
        return;
      }
      attemptNonceRef.current += 1;
      activeAttemptRef.current = null;
      setAsset(null);
      setJourney((s) =>
        applyRejectedPick(s, result.message, result.rejected?.fileName)
      );
      return;
    }
    attemptNonceRef.current += 1;
    activeAttemptRef.current = null;
    setAsset(result.asset);
    setJourney((s) => applyAcceptedPick(s));
  }, [busy]);

  const onCancelUpload = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const runPublishPipeline = useCallback(
    async (picked: PickedVideoAsset, captionText: string) => {
      if (!user || !session) {
        setJourney((s) =>
          failPublish(s, new Error(t("create.signInToPublish")))
        );
        return;
      }

      const evaluation = evaluateCreateAsset(picked);
      if (!evaluation.ok) {
        setAsset(null);
        setJourney((s) =>
          applyRejectedPick(
            s,
            evaluation.message ?? t("create.pickFailed"),
            picked.fileName
          )
        );
        return;
      }

      const attemptId = nextCreateAttemptId(
        picked.id,
        ++attemptNonceRef.current
      );
      activeAttemptRef.current = attemptId;

      const started = beginUpload(journeyRef.current, {
        attemptId,
        assetId: picked.id,
      });
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
          throw new Error(t("create.signInToUpload"));
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
            if (isStaleCreateAttempt(activeAttemptRef.current, attemptId)) {
              return;
            }
            setJourney((s) => applyUploadProgress(s, progress.percent));
          },
        });

        if (isStaleCreateAttempt(activeAttemptRef.current, attemptId)) {
          if (uploaded.path) {
            await deleteOwnedVideoObject(getSupabase(), user.id, uploaded.path);
            await clearPendingVideoUpload(uploaded.path);
          }
          return;
        }

        uploadedPath = uploaded.path;
        setJourney((s) => completeUpload(s, uploaded.path));

        const {
          data: { user: liveUser },
        } = await getSupabase().auth.getUser();
        if (!liveUser || liveUser.id !== user.id) {
          await queuePendingVideoUpload(uploaded.path);
          throw Object.assign(new Error(t("create.signInToPublish")), {
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

        if (isStaleCreateAttempt(activeAttemptRef.current, attemptId)) {
          if (
            !result.ok &&
            result.videoPath &&
            result.code !== "auth_required"
          ) {
            await deleteOwnedVideoObject(
              getSupabase(),
              user.id,
              result.videoPath
            );
            await clearPendingVideoUpload(result.videoPath);
          }
          return;
        }

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
        const cleared = resetCreateDraftAfterPublish();
        setAsset(cleared.asset);
        setCaption(cleared.caption);
        setUgcAck(cleared.ugcAck);
        setJourney((s) => completePublish(s, result.postId));
      } catch (error) {
        if (isStaleCreateAttempt(activeAttemptRef.current, attemptId)) {
          return;
        }

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
                t("create.uploadFailed")
              )
            )
          )
        );
      } finally {
        abortRef.current = null;
      }
    },
    [profile, session, t, user]
  );

  const onPublish = useCallback(async () => {
    if (!asset || busy || !publishable) return;
    if (!canPublishWithUgcAck(ugcAck)) {
      setJourney((s) => ({
        ...s,
        phase: "error",
        error: t("create.ackRequired"),
      }));
      return;
    }
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
  }, [asset, busy, caption, publishable, runPublishPipeline, t, ugcAck]);

  const onRetry = useCallback(() => {
    const bound = bindRetryToCurrentAsset({
      asset,
      journey: journeyRef.current,
      nonce: attemptNonceRef.current + 1,
    });
    if (!bound.ok) {
      return;
    }
    setJourney((s) => retryFromError(s));
    void runPublishPipeline(bound.asset, caption);
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
        <Text style={styles.title}>{t("create.signInTitle")}</Text>
        <Text style={styles.body}>{t("create.signInBody")}</Text>
        <Pressable
          style={styles.primary}
          onPress={() => router.push("/(auth)/login")}
          accessibilityRole="button"
          accessibilityLabel={t("actions.signIn")}
        >
          <Text style={styles.primaryText}>{t("actions.signIn")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 24}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <Text style={styles.title}>{t("create.title")}</Text>
          <Text style={styles.body}>{t("create.subtitle")}</Text>
          <Text style={styles.hint}>{t("create.fileHint")}</Text>

          {appState !== "active" && busy ? (
            <Text
              style={styles.banner}
              accessibilityLiveRegion="polite"
              accessibilityLabel={t("create.backgroundUpload")}
            >
              {t("create.backgroundUpload")}
            </Text>
          ) : null}

          <Pressable
            style={[styles.secondary, busy && styles.disabled]}
            onPress={() => void onPick()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t("create.chooseA11y")}
            accessibilityHint={t("create.chooseHint")}
            accessibilityState={{ disabled: busy, busy: journey.phase === "picking" }}
          >
            <Text style={styles.secondaryText}>
              {asset ? t("create.chooseDifferent") : t("create.chooseVideo")}
            </Text>
          </Pressable>

          {journey.error && !asset ? (
            <View
              style={styles.errorBox}
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
            >
              <Text style={styles.errorTitle}>{t("create.pickFailed")}</Text>
              {journey.rejectedAssetLabel ? (
                <Text style={styles.cardMeta}>{journey.rejectedAssetLabel}</Text>
              ) : null}
              <Text style={styles.errorText}>{journey.error}</Text>
              <View style={styles.row}>
                <Pressable
                  style={styles.secondary}
                  onPress={() => void onPick()}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={t("create.chooseAnother")}
                  accessibilityState={{ disabled: busy }}
                >
                  <Text style={styles.secondaryText}>{t("create.chooseAnother")}</Text>
                </Pressable>
                <Pressable
                  style={styles.secondary}
                  onPress={() =>
                    setJourney((s) => ({ ...s, error: null, phase: "ready" }))
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t("actions.dismiss")}
                >
                  <Text style={styles.secondaryText}>{t("actions.dismiss")}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {asset ? (
            <View
              style={styles.card}
              accessibilityLabel={t("create.selectedA11y", {
                values: {
                  name: asset.fileName,
                  mb: (asset.byteSize / (1024 * 1024)).toFixed(1),
                },
              })}
            >
              <Text style={styles.cardTitle} numberOfLines={1}>
                {asset.fileName}
              </Text>
              <Text style={styles.cardMeta}>
                {(asset.byteSize / (1024 * 1024)).toFixed(1)} MB
                {asset.durationMs != null
                  ? ` · ${Math.round(asset.durationMs / 1000)}s`
                  : ` · ${t("create.durationUnavailable")}`}
                {asset.mimeType ? ` · ${asset.mimeType}` : ""}
              </Text>
              <Pressable
                onPress={resetSelection}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t("create.clearSelection")}
                accessibilityState={{ disabled: busy }}
              >
                <Text style={styles.link}>{t("create.clearSelection")}</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.empty}>
              {journey.error
                ? t("create.noVideoAfterError")
                : t("create.noVideo")}
            </Text>
          )}

          <Text style={styles.label}>{t("create.caption")}</Text>
          <TextInput
            style={styles.input}
            value={caption}
            onChangeText={setCaption}
            placeholder={t("create.captionPlaceholder")}
            placeholderTextColor={colors.textSubtle}
            multiline
            maxLength={MAX_CAPTION_LENGTH}
            editable={!busy}
            accessibilityLabel={t("create.caption")}
            accessibilityHint={t("create.captionHint", {
              values: { max: MAX_CAPTION_LENGTH },
            })}
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
            <Text style={styles.hint}>{t("create.privacyHint")}</Text>
          )}

          {journey.phase === "uploading" ||
          journey.phase === "queued" ||
          journey.phase === "processing" ? (
            <View
              style={styles.progressBlock}
              accessibilityRole="progressbar"
              accessibilityLabel={
                journey.phase === "uploading"
                  ? t("create.uploadProgressA11y", {
                      values: { percent: journey.uploadPercent },
                    })
                  : t("create.publishingA11y")
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
                  ? t("create.uploading", {
                      values: { percent: journey.uploadPercent },
                    })
                  : journey.message || t("create.publishing")}
              </Text>
              {journey.phase === "uploading" ? (
                <Pressable
                  style={styles.cancel}
                  onPress={onCancelUpload}
                  accessibilityRole="button"
                  accessibilityLabel={t("create.cancelUpload")}
                  accessibilityHint={t("create.cancelHint")}
                >
                  <Text style={styles.cancelText}>{t("create.cancelUpload")}</Text>
                </Pressable>
              ) : (
                <ActivityIndicator color={colors.accentCyan} />
              )}
            </View>
          ) : null}

          {journey.phase === "success" ? (
            <View style={styles.success} accessibilityRole="text">
              <Text style={styles.successTitle}>{t("create.success")}</Text>
              <Pressable
                style={styles.primary}
                onPress={() =>
                  router.replace(
                    openWatchAfterPublishHref(journey.publishedPostId) as never
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={t("create.openWatch")}
              >
                <Text style={styles.primaryText}>{t("create.openWatch")}</Text>
              </Pressable>
              <Pressable
                onPress={resetSelection}
                accessibilityRole="button"
                accessibilityLabel={t("create.another")}
              >
                <Text style={styles.link}>{t("create.another")}</Text>
              </Pressable>
            </View>
          ) : null}

          {journey.error && asset ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Text style={styles.errorTitle}>{t("create.publishFailed")}</Text>
              <Text style={styles.errorText}>{journey.error}</Text>
              <View style={styles.row}>
                <Pressable
                  style={styles.secondary}
                  onPress={onRetry}
                  disabled={!asset || !evaluateCreateAsset(asset).ok}
                  accessibilityRole="button"
                  accessibilityLabel={t("actions.retry")}
                  accessibilityState={{
                    disabled: !asset || !evaluateCreateAsset(asset).ok,
                  }}
                >
                  <Text style={styles.secondaryText}>{t("actions.retry")}</Text>
                </Pressable>
                <Pressable
                  style={styles.secondary}
                  onPress={() =>
                    setJourney((s) => ({ ...s, error: null, phase: "ready" }))
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t("actions.dismiss")}
                >
                  <Text style={styles.secondaryText}>{t("actions.dismiss")}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <Pressable
            style={styles.ackRow}
            onPress={() => setUgcAck((value) => !value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: ugcAck }}
            accessibilityLabel={t("create.ack")}
          >
            <View
              style={[styles.checkbox, ugcAck && styles.checkboxChecked]}
              accessible={false}
            >
              {ugcAck ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <Text style={styles.ackText}>{t("create.ack")}</Text>
          </Pressable>
          <Pressable
            onPress={() => void Linking.openURL(UGC_TERMS_URL)}
            accessibilityRole="link"
            accessibilityLabel={t("create.openTerms")}
          >
            <Text style={styles.link}>{t("create.readTerms")}</Text>
          </Pressable>

          <Pressable
            style={[styles.primary, !publishable && styles.disabled]}
            onPress={() => void onPublish()}
            disabled={!publishable}
            accessibilityRole="button"
            accessibilityLabel={t("create.publish")}
            accessibilityHint={t("create.publishHint")}
            accessibilityState={{
              disabled: !publishable,
              busy,
            }}
          >
            {busy ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.primaryText} numberOfLines={1}>
                {t("create.publish")}
              </Text>
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
    borderColor: colors.danger,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  errorTitle: {
    color: colors.danger,
    fontWeight: "700",
    fontSize: 15,
  },
  errorText: {
    color: colors.danger,
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  ackRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.accentCyan,
    borderColor: colors.accentCyan,
  },
  checkboxMark: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 16,
  },
  ackText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
