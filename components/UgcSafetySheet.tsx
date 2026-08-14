import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  UGC_REASON_CODES,
  UGC_REASON_LABELS,
  canBlockUser,
  type UgcReasonCode,
} from "@/src/lib/safety/ugcPolicy";
import { colors } from "@/src/theme/colors";

export type UgcSafetyTarget = {
  postId?: number | null;
  userId?: string | null;
  displayName?: string | null;
};

export type UgcSafetyMode = "menu" | "report-content" | "report-user" | "block";

type Props = {
  visible: boolean;
  viewerId?: string | null;
  target: UgcSafetyTarget | null;
  busy?: boolean;
  error?: string | null;
  confirmation?: string | null;
  onClose: () => void;
  onReportContent: (reason: UgcReasonCode, detail: string | null) => void;
  onReportUser: (reason: UgcReasonCode, detail: string | null) => void;
  onBlockUser: () => void;
};

export function UgcSafetySheet({
  visible,
  viewerId,
  target,
  busy = false,
  error,
  confirmation,
  onClose,
  onReportContent,
  onReportUser,
  onBlockUser,
}: Props) {
  const [mode, setMode] = useState<UgcSafetyMode>("menu");
  const [reason, setReason] = useState<UgcReasonCode | null>(null);
  const [detail, setDetail] = useState("");

  const canReportVideo = Boolean(target?.postId);
  const canReportAccount = Boolean(target?.userId);
  const canBlock = canBlockUser(viewerId, target?.userId);

  const reset = useCallback(() => {
    setMode("menu");
    setReason(null);
    setDetail("");
  }, []);

  useEffect(() => {
    if (visible && !confirmation) {
      reset();
    }
  }, [confirmation, reset, visible]);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const title = useMemo(() => {
    if (confirmation) return "Thanks";
    if (mode === "report-content") return "Report video";
    if (mode === "report-user") return "Report account";
    if (mode === "block") return "Block account";
    return "Safety";
  }, [confirmation, mode]);

  const submitReport = useCallback(() => {
    if (!reason) return;
    const trimmed = detail.trim() || null;
    if (mode === "report-content") {
      onReportContent(reason, trimmed);
      return;
    }
    onReportUser(reason, trimmed);
  }, [detail, mode, onReportContent, onReportUser, reason]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View style={styles.backdrop}>
        <View
          style={styles.sheet}
          accessibilityViewIsModal
          accessibilityLabel={title}
        >
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {target?.displayName ? (
            <Text style={styles.subtitle}>{target.displayName}</Text>
          ) : null}

          {confirmation ? (
            <Text style={styles.success} accessibilityRole="text">
              {confirmation}
            </Text>
          ) : mode === "menu" ? (
            <View style={styles.stack}>
              {canReportVideo ? (
                <Pressable
                  style={styles.row}
                  onPress={() => setMode("report-content")}
                  accessibilityRole="button"
                  accessibilityLabel="Report this video"
                >
                  <Text style={styles.rowText}>Report video</Text>
                </Pressable>
              ) : null}
              {canReportAccount ? (
                <Pressable
                  style={styles.row}
                  onPress={() => setMode("report-user")}
                  accessibilityRole="button"
                  accessibilityLabel="Report this account"
                >
                  <Text style={styles.rowText}>Report account</Text>
                </Pressable>
              ) : null}
              {canBlock ? (
                <Pressable
                  style={styles.row}
                  onPress={() => setMode("block")}
                  accessibilityRole="button"
                  accessibilityLabel="Block this account"
                >
                  <Text style={[styles.rowText, styles.danger]}>Block account</Text>
                </Pressable>
              ) : null}
            </View>
          ) : mode === "block" ? (
            <View style={styles.stack}>
              <Text style={styles.body}>
                You will no longer see this account in Watch, Discover, or
                Messages. They will not be able to message you.
              </Text>
              <Pressable
                style={[styles.primary, busy && styles.disabled]}
                onPress={onBlockUser}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Confirm block"
                accessibilityState={{ disabled: busy, busy }}
              >
                {busy ? (
                  <ActivityIndicator color={colors.bg} />
                ) : (
                  <Text style={styles.primaryText}>Block</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <ScrollView style={styles.reasons} keyboardShouldPersistTaps="handled">
              {UGC_REASON_CODES.map((code) => (
                <Pressable
                  key={code}
                  style={[styles.reason, reason === code && styles.reasonOn]}
                  onPress={() => setReason(code)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: reason === code }}
                  accessibilityLabel={UGC_REASON_LABELS[code]}
                >
                  <Text style={styles.reasonText}>{UGC_REASON_LABELS[code]}</Text>
                </Pressable>
              ))}
              <TextInput
                style={styles.input}
                value={detail}
                onChangeText={setDetail}
                placeholder="Optional details"
                placeholderTextColor={colors.textSubtle}
                maxLength={1000}
                multiline
                accessibilityLabel="Optional report details"
              />
              <Pressable
                style={[styles.primary, (!reason || busy) && styles.disabled]}
                onPress={submitReport}
                disabled={!reason || busy}
                accessibilityRole="button"
                accessibilityLabel="Submit report"
                accessibilityState={{ disabled: !reason || busy, busy }}
              >
                {busy ? (
                  <ActivityIndicator color={colors.bg} />
                ) : (
                  <Text style={styles.primaryText}>Submit report</Text>
                )}
              </Pressable>
            </ScrollView>
          )}

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close safety options"
            style={styles.close}
          >
            <Text style={styles.closeText}>{confirmation ? "Done" : "Cancel"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.62)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 20,
    maxHeight: "86%",
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
  },
  body: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  stack: { gap: 8 },
  row: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  rowText: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 16,
  },
  danger: { color: colors.danger },
  reasons: { maxHeight: 420 },
  reason: {
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
    marginBottom: 6,
    backgroundColor: colors.bg,
  },
  reasonOn: {
    borderWidth: 1,
    borderColor: colors.accentCyan,
  },
  reasonText: { color: colors.text, fontSize: 15 },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    color: colors.text,
    marginTop: 8,
    marginBottom: 12,
    textAlignVertical: "top",
  },
  primary: {
    backgroundColor: colors.text,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: colors.bg, fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.55 },
  error: { color: colors.danger, lineHeight: 20 },
  success: { color: colors.success, lineHeight: 22, fontWeight: "600" },
  close: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  closeText: { color: colors.accentCyan, fontWeight: "700" },
});
