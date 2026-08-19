import { useMemo, useRef } from "react";
import { PanResponder, Text, View } from "react-native";

import {
  applyOverlayDrag,
  overlayCanvasStyle,
  overlayElementTransform,
  overlayHitSize,
} from "@/src/lib/video/overlayDrag";
import { overlayTextStyle } from "@/src/lib/video/overlayText";
import type { VideoOverlayElement } from "@/src/lib/video/videoOverlays";
import { colors } from "@/src/theme/colors";

type VideoOverlayLayerProps = {
  elements: VideoOverlayElement[];
  width: number;
  height: number;
  /** Editor-only. Watch playback must omit this so overlays stay display-only. */
  editable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onMove?: (id: string, x: number, y: number) => void;
};

type OverlayGlyphProps = {
  el: VideoOverlayElement;
  fontSize: number;
};

function OverlayGlyph({ el, fontSize }: OverlayGlyphProps) {
  const textStyle = overlayTextStyle(el.kind === "text" ? el.text : undefined);
  return (
    <Text
      style={{
        color: el.kind === "text" ? el.color || "#fff" : "#fff",
        fontSize,
        fontWeight: "800",
        textAlign: textStyle.textAlign,
        writingDirection: textStyle.writingDirection,
        textShadowColor: "rgba(0,0,0,0.75)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
      }}
    >
      {el.kind === "text" ? el.text : el.emoji}
    </Text>
  );
}

function DraggableOverlay({
  el,
  width,
  height,
  selected,
  onSelect,
  onMove,
}: {
  el: VideoOverlayElement;
  width: number;
  height: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const edge = Math.min(width, height);
  const size = el.scale * edge;
  const fontSize = el.kind === "sticker" ? size : Math.max(14, size * 0.85);
  const hit = overlayHitSize(el.scale, edge);
  const posRef = useRef({ x: el.x, y: el.y });
  posRef.current = { x: el.x, y: el.y };
  const startRef = useRef({ x: el.x, y: el.y });
  const dimsRef = useRef({ width, height });
  dimsRef.current = { width, height };
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          startRef.current = { x: posRef.current.x, y: posRef.current.y };
          onSelectRef.current(el.id);
        },
        onPanResponderMove: (_event, gesture) => {
          const next = applyOverlayDrag(
            startRef.current,
            gesture.dx,
            gesture.dy,
            dimsRef.current.width,
            dimsRef.current.height
          );
          onMoveRef.current(el.id, next.x, next.y);
        },
      }),
    [el.id]
  );

  return (
    <View
      {...pan.panHandlers}
      collapsable={false}
      accessibilityRole="adjustable"
      accessibilityState={{ selected }}
      accessibilityLabel={el.kind === "text" ? el.text : el.emoji}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        minWidth: hit,
        minHeight: hit,
        alignItems: "center",
        justifyContent: "center",
        transform: overlayElementTransform(
          el.x,
          el.y,
          el.rotation,
          width,
          height,
          hit / 2
        ),
        maxWidth: width * 0.9,
        borderWidth: selected ? 2 : 0,
        borderColor: colors.accentCyan,
        borderRadius: 8,
      }}
    >
      <OverlayGlyph el={el} fontSize={fontSize} />
    </View>
  );
}

export function VideoOverlayLayer({
  elements,
  width,
  height,
  editable = false,
  selectedId = null,
  onSelect,
  onMove,
}: VideoOverlayLayerProps) {
  if (!width || !height || elements.length === 0) {
    return null;
  }
  const edge = Math.min(width, height);
  const canvas = overlayCanvasStyle(width, height);

  if (!editable) {
    return (
      <View pointerEvents="none" style={canvas}>
        {elements.map((el) => {
          const size = el.scale * edge;
          const fontSize = el.kind === "sticker" ? size : Math.max(14, size * 0.85);
          return (
            <View
              key={el.id}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                transform: overlayElementTransform(
                  el.x,
                  el.y,
                  el.rotation,
                  width,
                  height,
                  size / 2
                ),
                maxWidth: width * 0.9,
              }}
            >
              <OverlayGlyph el={el} fontSize={fontSize} />
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View collapsable={false} pointerEvents="box-none" style={canvas}>
      {elements.map((el) => (
        <DraggableOverlay
          key={el.id}
          el={el}
          width={width}
          height={height}
          selected={selectedId === el.id}
          onSelect={onSelect ?? (() => undefined)}
          onMove={onMove ?? (() => undefined)}
        />
      ))}
    </View>
  );
}
