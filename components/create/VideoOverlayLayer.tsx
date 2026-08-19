import { Text, View } from "react-native";

import type { VideoOverlayElement } from "@/src/lib/video/videoOverlays";

type VideoOverlayLayerProps = {
  elements: VideoOverlayElement[];
  width: number;
  height: number;
};

export function VideoOverlayLayer({
  elements,
  width,
  height,
}: VideoOverlayLayerProps) {
  if (!width || !height || elements.length === 0) {
    return null;
  }
  const edge = Math.min(width, height);
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, top: 0, width, height }}
    >
      {elements.map((el) => {
        const size = el.scale * edge;
        const fontSize = el.kind === "sticker" ? size : Math.max(14, size * 0.85);
        return (
          <View
            key={el.id}
            style={{
              position: "absolute",
              left: el.x * width,
              top: el.y * height,
              transform: [
                { translateX: -size / 2 },
                { translateY: -size / 2 },
                { rotate: `${el.rotation}deg` },
              ],
              maxWidth: width * 0.9,
            }}
          >
            <Text
              style={{
                color: el.kind === "text" ? el.color || "#fff" : "#fff",
                fontSize,
                fontWeight: "800",
                textAlign: "center",
                textShadowColor: "rgba(0,0,0,0.75)",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 3,
              }}
            >
              {el.kind === "text" ? el.text : el.emoji}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
