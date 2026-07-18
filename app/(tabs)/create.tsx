import { ScrollView, Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";

import { PhasePlaceholder } from "@/components/PhasePlaceholder";
import {
  getPermissionExplanation,
  requestCameraPermission,
  requestMediaLibraryPermission,
  requestMicrophonePermission,
  type PermissionOutcome,
} from "@/src/lib/permissions/foundation";
import { colors } from "@/src/theme/colors";

export default function CreateScreen() {
  const [last, setLast] = useState<PermissionOutcome | null>(null);

  const run = async (fn: () => Promise<PermissionOutcome>) => {
    const result = await fn();
    setLast(result);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <PhasePlaceholder
        title="Create — Phase 2"
        body="Composer, upload, and publish land next. You can preview permission prompts now."
        compact
      />
      <View style={styles.actions}>
        <Text style={styles.section}>Device permissions</Text>
        <Pressable
          style={styles.btn}
          onPress={() => void run(requestCameraPermission)}
          accessibilityRole="button"
          accessibilityLabel="Request camera permission"
        >
          <Text style={styles.btnText}>Request camera</Text>
        </Pressable>
        <Pressable
          style={styles.btn}
          onPress={() => void run(requestMicrophonePermission)}
          accessibilityRole="button"
          accessibilityLabel="Request microphone permission"
        >
          <Text style={styles.btnText}>Request microphone</Text>
        </Pressable>
        <Pressable
          style={styles.btn}
          onPress={() => void run(requestMediaLibraryPermission)}
          accessibilityRole="button"
          accessibilityLabel="Request media library permission"
        >
          <Text style={styles.btnText}>Request media library</Text>
        </Pressable>
        {last ? (
          <Text style={styles.result}>
            {last.kind}: {last.granted ? "granted" : "denied"}
            {"\n"}
            {getPermissionExplanation(last.kind)}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: 40,
    flexGrow: 1,
  },
  actions: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 10,
  },
  section: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  btn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: "center",
  },
  btnText: {
    color: colors.text,
    fontWeight: "600",
  },
  result: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
});
