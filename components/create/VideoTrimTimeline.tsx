import { useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";

import { formatTrimTimestamp } from "@/src/lib/media/videoTrim";
import {
  applyInHandleDrag,
  applyOutHandleDrag,
  applyPlayheadDrag,
  hitTestTimelineHandle,
  msFromTimelineX,
  selectedRangeStyle,
  TIMELINE_HANDLE_HIT_PX,
  timelineThumbStarts,
  xFromTimelineMs,
} from "@/src/lib/video/videoTimeline";
import type { VideoKeepSegment } from "@/src/lib/video/videoSegments";
import { selectedKeepDurationMs } from "@/src/lib/video/videoSegments";
import { OVERLAY_INTERACTION_LAYOUT_DIRECTION } from "@/src/lib/video/overlayDrag";
import { colors } from "@/src/theme/colors";

type Props = {
  durationMs: number;
  inMs: number;
  outMs: number;
  playheadMs: number;
  segments: readonly VideoKeepSegment[];
  selectedSegmentIndex: number | null;
  onTrimChange: (next: { inMs: number; outMs: number }) => void;
  onPlayheadChange: (ms: number) => void;
  onSelectSegment: (index: number | null) => void;
  startLabel: string;
  endLabel: string;
  durationLabel: string;
};

export function VideoTrimTimeline({
  durationMs,
  inMs,
  outMs,
  playheadMs,
  segments,
  selectedSegmentIndex,
  onTrimChange,
  onPlayheadChange,
  onSelectSegment,
  startLabel,
  endLabel,
  durationLabel,
}: Props) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const dragRef = useRef<"in" | "out" | "playhead" | null>(null);
  const thumbs = useMemo(
    () => timelineThumbStarts(durationMs),
    [durationMs]
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    widthRef.current = next;
    setWidth(next);
  };

  function resolveMs(event: GestureResponderEvent): number {
    return msFromTimelineX({
      x: event.nativeEvent.locationX,
      width: widthRef.current,
      durationMs,
    });
  }

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const x = event.nativeEvent.locationX;
          const inX = xFromTimelineMs({
            ms: inMs,
            width: widthRef.current,
            durationMs,
          });
          const outX = xFromTimelineMs({
            ms: outMs,
            width: widthRef.current,
            durationMs,
          });
          dragRef.current = hitTestTimelineHandle({ x, inX, outX });
          const ms = resolveMs(event);
          if (dragRef.current === "playhead") {
            onPlayheadChange(applyPlayheadDrag({ proposedMs: ms, durationMs }));
          }
        },
        onPanResponderMove: (event) => {
          const ms = resolveMs(event);
          if (dragRef.current === "in") {
            onTrimChange(
              applyInHandleDrag({
                proposedInMs: ms,
                outMs,
                durationMs,
              })
            );
            onPlayheadChange(ms);
            return;
          }
          if (dragRef.current === "out") {
            onTrimChange(
              applyOutHandleDrag({
                inMs,
                proposedOutMs: ms,
                durationMs,
              })
            );
            onPlayheadChange(ms);
            return;
          }
          onPlayheadChange(applyPlayheadDrag({ proposedMs: ms, durationMs }));
        },
        onPanResponderRelease: () => {
          dragRef.current = null;
        },
        onPanResponderTerminate: () => {
          dragRef.current = null;
        },
      }),
    [durationMs, inMs, onPlayheadChange, onTrimChange, outMs]
  );

  const range = selectedRangeStyle({
    inMs,
    outMs,
    durationMs,
    width,
  });
  const playheadX = xFromTimelineMs({
    ms: playheadMs,
    width,
    durationMs,
  });
  const inX = xFromTimelineMs({ ms: inMs, width, durationMs });
  const outX = xFromTimelineMs({ ms: outMs, width, durationMs });
  const keptMs = selectedKeepDurationMs(segments);

  return (
    <View style={styles.wrap}>
      <View style={styles.clocks}>
        <Text style={styles.clock}>
          {startLabel} {formatTrimTimestamp(inMs)}
        </Text>
        <Text style={styles.clock}>
          {durationLabel} {formatTrimTimestamp(keptMs)}
        </Text>
        <Text style={styles.clock}>
          {endLabel} {formatTrimTimestamp(outMs)}
        </Text>
      </View>
      <View
        style={styles.track}
        onLayout={onLayout}
        {...pan.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={`${startLabel} ${formatTrimTimestamp(inMs)}, ${endLabel} ${formatTrimTimestamp(outMs)}`}
      >
        <View style={[styles.film, { direction: OVERLAY_INTERACTION_LAYOUT_DIRECTION }]}>
          {thumbs.map((start, index) => (
            <View key={`${start}-${index}`} style={styles.thumb}>
              <Text style={styles.thumbText}>{formatTrimTimestamp(start)}</Text>
            </View>
          ))}
        </View>
        {segments.map((seg, index) => {
          const style = selectedRangeStyle({
            inMs: seg.startMs,
            outMs: seg.endMs,
            durationMs,
            width,
          });
          return (
            <View
              key={`${seg.startMs}-${seg.endMs}-${index}`}
              pointerEvents="none"
              style={[
                styles.kept,
                {
                  left: style.left,
                  width: style.width,
                  opacity: selectedSegmentIndex === index ? 1 : 0.7,
                  borderColor:
                    selectedSegmentIndex === index
                      ? colors.accentCyan
                      : "transparent",
                },
              ]}
            />
          );
        })}
        <View
          pointerEvents="none"
          style={[styles.selected, { left: range.left, width: range.width }]}
        />
        <View
          pointerEvents="box-none"
          style={[styles.handle, { left: Math.max(0, inX - TIMELINE_HANDLE_HIT_PX / 2) }]}
        >
          <View style={styles.handleBar} />
          <Text style={styles.handleGlyph}>IN</Text>
        </View>
        <View
          pointerEvents="box-none"
          style={[styles.handle, { left: Math.max(0, outX - TIMELINE_HANDLE_HIT_PX / 2) }]}
        >
          <View style={styles.handleBar} />
          <Text style={styles.handleGlyph}>OUT</Text>
        </View>
        <View
          pointerEvents="none"
          style={[styles.playhead, { left: Math.max(0, playheadX - 1) }]}
        />
      </View>
      <View style={styles.segmentHits}>
        {segments.map((seg, index) => (
          <Pressable
            key={`hit-${seg.startMs}-${index}`}
            style={[
              styles.segmentHit,
              selectedSegmentIndex === index && styles.segmentHitOn,
            ]}
            onPress={() =>
              onSelectSegment(selectedSegmentIndex === index ? null : index)
            }
            accessibilityRole="button"
            accessibilityState={{ selected: selectedSegmentIndex === index }}
          >
            <Text
              style={[
                styles.segmentHitText,
                selectedSegmentIndex === index && styles.segmentHitTextOn,
              ]}
            >
              {index + 1}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  clocks: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  clock: { color: colors.textMuted, fontSize: 12, fontWeight: "700", flexShrink: 1 },
  track: {
    height: 76,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  film: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: "row",
  },
  thumb: {
    flex: 1,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 4,
    backgroundColor: "#1b1b1f",
  },
  thumbText: { color: colors.textSubtle, fontSize: 9 },
  selected: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: colors.accentCyan,
    backgroundColor: "rgba(0, 200, 220, 0.12)",
  },
  kept: {
    position: "absolute",
    top: 8,
    bottom: 8,
    borderRadius: 6,
    backgroundColor: "rgba(0, 200, 220, 0.28)",
    borderWidth: 2,
  },
  handle: {
    position: "absolute",
    top: 0,
    width: TIMELINE_HANDLE_HIT_PX,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
  },
  handleBar: {
    width: 6,
    flex: 1,
    marginVertical: 6,
    borderRadius: 3,
    backgroundColor: colors.accentCyan,
  },
  handleGlyph: {
    position: "absolute",
    bottom: 4,
    color: colors.bg,
    backgroundColor: colors.accentCyan,
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  playhead: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#fff",
  },
  segmentHits: { flexDirection: "row", gap: 8 },
  segmentHit: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: "hidden",
  },
  segmentHitOn: {
    borderColor: colors.accentCyan,
  },
  segmentHitText: {
    color: colors.text,
    fontWeight: "700",
  },
  segmentHitTextOn: {
    color: colors.accentCyan,
  },
});
