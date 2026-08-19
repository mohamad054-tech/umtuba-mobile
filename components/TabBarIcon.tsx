import { View, type ColorValue } from "react-native";

import {
  TAB_ICON_STROKE,
  type PrimaryTabId,
} from "@/src/lib/nav/tabBarMetrics";

type TabBarIconProps = {
  id: PrimaryTabId;
  color: ColorValue;
  size: number;
  focused?: boolean;
};

function stroke(color: ColorValue) {
  return {
    borderColor: color,
    borderWidth: TAB_ICON_STROKE,
  };
}

function WatchGlyph({ color, size }: { color: ColorValue; size: number }) {
  const triangle = size * 0.22;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        ...stroke(color),
      }}
    >
      <View
        style={{
          width: 0,
          height: 0,
          marginLeft: size * 0.08,
          borderStyle: "solid",
          borderTopWidth: triangle * 0.85,
          borderBottomWidth: triangle * 0.85,
          borderLeftWidth: triangle * 1.35,
          borderTopColor: "transparent",
          borderBottomColor: "transparent",
          borderLeftColor: color,
        }}
      />
    </View>
  );
}

function DiscoverGlyph({ color, size }: { color: ColorValue; size: number }) {
  const needle = size * 0.38;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        ...stroke(color),
      }}
    >
      <View
        style={{
          width: TAB_ICON_STROKE + 0.5,
          height: needle,
          backgroundColor: color,
          borderRadius: 2,
          transform: [{ rotate: "28deg" }],
        }}
      />
      <View
        style={{
          position: "absolute",
          width: size * 0.18,
          height: size * 0.18,
          borderRadius: size,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function CreateGlyph({
  color,
  size,
  focused,
}: {
  color: ColorValue;
  size: number;
  focused?: boolean;
}) {
  const arm = size * 0.42;
  const thickness = Math.max(3, size * 0.12);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? color : "transparent",
        ...stroke(color),
      }}
    >
      <View
        style={{
          position: "absolute",
          width: arm,
          height: thickness,
          borderRadius: 2,
          backgroundColor: focused ? "#050510" : color,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: thickness,
          height: arm,
          borderRadius: 2,
          backgroundColor: focused ? "#050510" : color,
        }}
      />
    </View>
  );
}

function LiveGlyph({ color, size }: { color: ColorValue; size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        ...stroke(color),
      }}
    >
      <View
        style={{
          width: size * 0.34,
          height: size * 0.34,
          borderRadius: size,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function MessagesGlyph({ color, size }: { color: ColorValue; size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size * 0.72,
        borderRadius: 5,
        ...stroke(color),
      }}
    />
  );
}

function ProfileGlyph({ color, size }: { color: ColorValue; size: number }) {
  const head = size * 0.3;
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "flex-end",
      }}
    >
      <View
        style={{
          width: head,
          height: head,
          borderRadius: head,
          marginBottom: size * 0.08,
          ...stroke(color),
        }}
      />
      <View
        style={{
          width: size * 0.72,
          height: size * 0.32,
          borderTopLeftRadius: size,
          borderTopRightRadius: size,
          ...stroke(color),
        }}
      />
    </View>
  );
}

export function TabBarIcon({ id, color, size, focused }: TabBarIconProps) {
  const common = { color, size };
  switch (id) {
    case "watch":
      return <WatchGlyph {...common} />;
    case "discover":
      return <DiscoverGlyph {...common} />;
    case "create":
      return <CreateGlyph {...common} focused={focused} />;
    case "live":
      return <LiveGlyph {...common} />;
    case "messages":
      return <MessagesGlyph {...common} />;
    case "profile":
      return <ProfileGlyph {...common} />;
    default:
      return null;
  }
}
