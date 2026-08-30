import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { encodeContactQrModules } from "@/src/lib/comms/qrModules";
import { colors } from "@/src/theme/colors";

type PersonalQrGridProps = {
  url: string;
  size?: number;
};

export function PersonalQrGrid({ url, size = 176 }: PersonalQrGridProps) {
  const modules = useMemo(() => encodeContactQrModules(url), [url]);
  const n = modules.length;
  const quiet = 4;
  const dim = n + quiet * 2;
  const cell = size / dim;

  return (
    <View
      style={[styles.board, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel="Personal UMTUBA QR"
      accessible
    >
      {modules.map((row, y) =>
        row.map((on, x) =>
          on ? (
            <View
              key={`${x}-${y}`}
              style={{
                position: "absolute",
                left: (x + quiet) * cell,
                top: (y + quiet) * cell,
                width: cell,
                height: cell,
                backgroundColor: colors.bg,
              }}
            />
          ) : null
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: "#f4f7ff",
    borderRadius: 16,
    overflow: "hidden",
  },
});
