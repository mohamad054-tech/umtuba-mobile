import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslation } from "@/src/lib/i18n";
import { isRtlLocale } from "@/src/lib/i18n/locales";
import {
  clampWatchVolume,
  quantizeWatchVolume,
} from "@/src/lib/watch/playbackPolicy";
import {
  resolveVerticalVolumeRatio,
  resolveWatchVolumeIcon,
  resolveWatchVolumeLeft,
  resolveWatchVolumeSide,
  resolveWatchVolumeTop,
  watchVolumeIconGlyph,
  WATCH_VOLUME_AUTO_HIDE_MS,
  WATCH_VOLUME_SLIDER_LENGTH,
  WATCH_VOLUME_TOUCH_TARGET,
  WATCH_VOLUME_TRACK_THICKNESS,
} from "@/src/lib/watch/volumeLayout";
import { colors } from "@/src/theme/colors";

export type WatchSideVolumeControlProps = {
  volume: number;
  muted: boolean;
  topInset: number;
  bottomInset: number;
  onVolumeChange: (volume: number) => void;
  onGestureActiveChange?: (active: boolean) => void;
};

export function WatchSideVolumeControl({
  volume,
  muted,
  topInset,
  bottomInset,
  onVolumeChange,
  onGestureActiveChange,
}: WatchSideVolumeControlProps) {
  const { t, locale } = useTranslation();
  const insets = useSafeAreaInsets();
  const [cellHeight, setCellHeight] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [gestureActive, setGestureActive] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackRef = useRef<View>(null);
  const frameRef = useRef({ y: 0, height: 1 });
  const scrubbingRef = useRef(false);
  const [localRatio, setLocalRatio] = useState(volume);

  const isRtl = isRtlLocale(locale);
  const side = resolveWatchVolumeSide(isRtl);
  const iconKind = resolveWatchVolumeIcon({ muted, volume });
  const percent = Math.round(volume * 100);

  useEffect(() => {
    if (!scrubbingRef.current) {
      setLocalRatio(volume);
    }
  }, [volume]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    };
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }
    hideTimer.current = setTimeout(() => {
      setExpanded(false);
      hideTimer.current = null;
    }, WATCH_VOLUME_AUTO_HIDE_MS);
  }, []);

  const revealSlider = useCallback(() => {
    setExpanded(true);
    scheduleHide();
  }, [scheduleHide]);

  const emitVolume = useCallback(
    (ratio: number) => {
      onVolumeChange(quantizeWatchVolume(clampWatchVolume(ratio)));
    },
    [onVolumeChange]
  );

  const measureTrack = useCallback((after?: () => void) => {
    trackRef.current?.measureInWindow((_x, y, _width, height) => {
      frameRef.current = {
        y,
        height: Math.max(1, height),
      };
      after?.();
    });
  }, []);

  const applyFromEvent = useCallback(
    (event: GestureResponderEvent, emit: boolean) => {
      const next = resolveVerticalVolumeRatio(
        event.nativeEvent.pageY,
        frameRef.current.y,
        frameRef.current.height
      );
      setLocalRatio(next);
      if (emit) {
        emitVolume(next);
      }
    },
    [emitVolume]
  );

  const setGesture = useCallback(
    (active: boolean) => {
      setGestureActive(active);
      onGestureActiveChange?.(active);
      if (active) {
        if (hideTimer.current) {
          clearTimeout(hideTimer.current);
          hideTimer.current = null;
        }
        setExpanded(true);
      } else {
        scheduleHide();
      }
    },
    [onGestureActiveChange, scheduleHide]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (event) => {
          scrubbingRef.current = true;
          setGesture(true);
          const pageY = event.nativeEvent.pageY;
          measureTrack(() => {
            const next = resolveVerticalVolumeRatio(
              pageY,
              frameRef.current.y,
              frameRef.current.height
            );
            setLocalRatio(next);
            emitVolume(next);
          });
          applyFromEvent(event, true);
        },
        onPanResponderMove: (event) => {
          applyFromEvent(event, true);
        },
        onPanResponderRelease: (event) => {
          applyFromEvent(event, true);
          scrubbingRef.current = false;
          setGesture(false);
        },
        onPanResponderTerminate: () => {
          scrubbingRef.current = false;
          setGesture(false);
        },
      }),
    [applyFromEvent, emitVolume, measureTrack, setGesture]
  );

  const onCellLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    if (Number.isFinite(next) && next > 0) {
      setCellHeight(next);
    }
  }, []);

  const onTrackLayout = useCallback(() => {
    measureTrack();
  }, [measureTrack]);

  const top = resolveWatchVolumeTop({
    cellHeight,
    topInset,
    bottomInset,
    expanded,
  });
  const edge = resolveWatchVolumeLeft({ leftInset: insets.left });
  const sideStyle =
    side === "left"
      ? { left: edge, right: undefined }
      : { right: edge, left: undefined };

  return (
    <View
      style={styles.cell}
      pointerEvents="box-none"
      onLayout={onCellLayout}
      testID="watch-side-volume"
    >
      <View
        style={[styles.stack, { top }, sideStyle]}
        pointerEvents="box-none"
        accessibilityElementsHidden={false}
      >
        {expanded ? (
          <Text
            style={styles.level}
            accessibilityLiveRegion={gestureActive ? "polite" : "none"}
          >
            {t("watch.volume", { values: { percent } })}
          </Text>
        ) : null}

        {expanded ? (
          <View
            ref={trackRef}
            style={styles.sliderHit}
            onLayout={onTrackLayout}
            collapsable={false}
            accessibilityRole="adjustable"
            accessibilityLabel={t("watch.volumeA11y")}
            accessibilityValue={{ min: 0, max: 100, now: percent }}
            testID="watch-side-volume-slider"
            {...panResponder.panHandlers}
          >
            <View style={styles.track}>
              <View
                style={[styles.fill, { height: `${localRatio * 100}%` }]}
              />
              <View
                style={[
                  styles.thumb,
                  { bottom: `${localRatio * 100}%` },
                ]}
              />
            </View>
          </View>
        ) : null}

        <Pressable
          style={styles.iconBtn}
          onPress={revealSlider}
          accessibilityRole="button"
          accessibilityLabel={t("watch.volumeA11y")}
          accessibilityHint={t("watch.volume", { values: { percent } })}
          accessibilityState={{ expanded }}
        >
          <Text style={styles.icon} allowFontScaling={false}>
            {watchVolumeIconGlyph(iconKind)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    ...StyleSheet.absoluteFill,
    zIndex: 7,
  },
  stack: {
    position: "absolute",
    width: WATCH_VOLUME_TOUCH_TARGET,
    alignItems: "center",
    gap: 6,
  },
  level: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  sliderHit: {
    width: WATCH_VOLUME_TOUCH_TARGET,
    height: WATCH_VOLUME_SLIDER_LENGTH,
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    width: WATCH_VOLUME_TRACK_THICKNESS,
    height: WATCH_VOLUME_SLIDER_LENGTH - 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.28)",
    overflow: "visible",
    justifyContent: "flex-end",
  },
  fill: {
    width: WATCH_VOLUME_TRACK_THICKNESS,
    borderRadius: 999,
    backgroundColor: colors.accentCyan,
    alignSelf: "flex-end",
  },
  thumb: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    marginBottom: -7,
    alignSelf: "center",
    left: (WATCH_VOLUME_TRACK_THICKNESS - 14) / 2,
    backgroundColor: colors.text,
    borderWidth: 1,
    borderColor: colors.accentCyan,
  },
  iconBtn: {
    width: WATCH_VOLUME_TOUCH_TARGET,
    height: WATCH_VOLUME_TOUCH_TARGET,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(5,5,16,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  icon: {
    fontSize: 18,
  },
});
