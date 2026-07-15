import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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

  const run = async (
    fn: () => Promise<PermissionOutcome>
  ) => {
    const result = await fn();
    setLast(result);
  };

  return (
    <View style={styles.root}>
      <PhasePlaceholder
        title="Create — Phase 2"
        body="Composer, upload, and publish land next. You can preview permission prompts now."
      />
      <View style={styles.actions}>
        <Pressable
          style={styles.btn}
          onPress={() => void run(requestCameraPermission)}
        >
          <Text style={styles.btnText}>Request camera</Text>
        </Pressable>
        <Pressable
          style={styles.btn}
          onPress={() => void run(requestMicrophonePermission)}
        >
          <Text style={styles.btnText}>Request microphone</Text>
        </Pressable>
        <Pressable
          style={styles.btn}
          onPress={() => void run(requestMediaLibraryPermission)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 10,
  },
  btn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
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
