import { View } from "react-native";
import type { ColorValue } from "react-native";

/**
 * Original UMTUBA UM Life mark — community / connection / life-pulse.
 * Abstract people + subtle U seat + pulse node. Not a platform clone.
 */
export function UmLifeTabIcon({ color }: { color: ColorValue }) {
  return (
    <View
      accessible={false}
      style={{ width: 22, height: 22, alignItems: "center", justifyContent: "center" }}
    >
      <View
        style={{
          width: 5,
          height: 5,
          borderRadius: 3,
          backgroundColor: color,
          marginBottom: 1,
        }}
      />
      <View style={{ flexDirection: "row", gap: 3 }}>
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            borderWidth: 1.6,
            borderColor: color,
          }}
        />
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            borderWidth: 1.6,
            borderColor: color,
          }}
        />
      </View>
      <View
        style={{
          marginTop: 1,
          width: 16,
          height: 6,
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
          borderWidth: 1.6,
          borderTopWidth: 0,
          borderColor: color,
        }}
      />
    </View>
  );
}
