import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  RefreshControl,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { WatchVideo } from "@/src/contracts/watch";
import {
  createWatchPlaybackController,
  planWatchEnginePlayerSlots,
  resolveWatchEngineItemSource,
  resolveWatchEngineReadiness,
  resolveWatchEngineWantsPlay,
  shouldMountWatchEnginePlayer,
  shouldRecreateWatchEnginePlayer,
  shouldRequestWatchEngineFeedTail,
  watchEngineItemSourceUri,
  watchEngineMediaId,
  resolveWatchEngineSnapDurationMs,
  resolveWatchEngineSnapOffset,
  watchEngineSrcSignature,
  WatchEnginePlayer,
  createWatchEngineTimelineStore,
  type WatchEngineReadiness,
  type WatchEngineSeekCommand,
  type WatchEngineTimeline,
  type WatchEngineTimelineStore,
} from "@/src/lib/watch/engine";
import { colors } from "@/src/theme/colors";

export type WatchEngineHostHandle = {
  snapToIndex: (index: number) => void;
};

export type WatchEngineHostProps = {
  videos: WatchVideo[];
  itemHeight: number;
  settledIndex: number;
  onSettledIndex: (index: number) => void;
  onRequestMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  muted: boolean;
  volume: number;
  screenFocused: boolean;
  listScrollEnabled: boolean;
  onActiveEnded: () => void;
  onReadiness?: (input: {
    mediaId: string;
    readiness: WatchEngineReadiness;
  }) => void;
  listFooter?: ReactNode;
  extraData?: string;
  renderChrome: (input: {
    item: WatchVideo;
    index: number;
    isActive: boolean;
    timeline: WatchEngineTimeline | null;
    onUserPausedChange?: (paused: boolean) => void;
    onSeekRatio?: (ratio: number) => void;
  }) => ReactNode;
};

function WatchEngineChromeBridge({
  mediaId,
  store,
  item,
  index,
  isActive,
  onUserPausedChange,
  onSeekRatio,
  renderChrome,
}: {
  mediaId: string;
  store: WatchEngineTimelineStore;
  item: WatchVideo;
  index: number;
  isActive: boolean;
  onUserPausedChange?: (paused: boolean) => void;
  onSeekRatio?: (ratio: number) => void;
  renderChrome: WatchEngineHostProps["renderChrome"];
}) {
  const timeline = useSyncExternalStore(
    (onStoreChange) => store.subscribe(mediaId, onStoreChange),
    () => store.get(mediaId)
  );
  return (
    <>
      {renderChrome({
        item,
        index,
        isActive,
        timeline,
        onUserPausedChange,
        onSeekRatio,
      })}
    </>
  );
}

export const WatchEngineHost = forwardRef<
  WatchEngineHostHandle,
  WatchEngineHostProps
>(function WatchEngineHost(
  {
    videos,
    itemHeight,
    settledIndex,
    onSettledIndex,
    onRequestMore,
    hasMore,
    loadingMore,
    refreshing,
    onRefresh,
    muted,
    volume,
    screenFocused,
    listScrollEnabled,
    onActiveEnded,
    onReadiness,
    listFooter,
    extraData,
    renderChrome,
  },
  ref
) {
  const listRef = useAnimatedRef<Animated.FlatList<WatchVideo>>();
  const engineRef = useRef(createWatchPlaybackController());
  const dragStartOffsetRef = useRef(0);
  const dragStartIndexRef = useRef(0);
  const lastOffsetRef = useRef(Math.max(0, settledIndex * itemHeight));
  const itemHeightRef = useRef(itemHeight);
  const settledRef = useRef(settledIndex);
  const snapGenRef = useRef(0);
  const snappingRef = useRef(false);
  const snapOffset = useSharedValue(0);
  const snapping = useSharedValue(false);
  const [audioOwner, setAudioOwner] = useState<string | null>(null);
  const [firstFrameById, setFirstFrameById] = useState<Record<string, boolean>>(
    {}
  );
  const [surfaceReadyById, setSurfaceReadyById] = useState<
    Record<string, boolean>
  >({});
  const timelineStoreRef = useRef(createWatchEngineTimelineStore());
  const seekTokenRef = useRef(0);
  const [seekRequest, setSeekRequest] = useState<
    (WatchEngineSeekCommand & { mediaId: string }) | null
  >(null);
  const playerIdentityRef = useRef<{ mediaId: string; src: string } | null>(
    null
  );
  const [userPaused, setUserPaused] = useState(false);

  useEffect(() => {
    setUserPaused(false);
    setSeekRequest(null);
  }, [settledIndex]);

  const onSeekRatio = useCallback((ratio: number) => {
    const current = videos[settledRef.current];
    if (!current) return;
    seekTokenRef.current += 1;
    setSeekRequest({
      mediaId: watchEngineMediaId(current),
      token: seekTokenRef.current,
      ratio,
    });
  }, [videos]);

  itemHeightRef.current = itemHeight;
  settledRef.current = settledIndex;

  const mediaIds = useMemo(
    () => videos.map((video) => watchEngineMediaId(video)),
    [videos]
  );

  useEffect(() => {
    engineRef.current.setMediaIds(mediaIds);
    const current = videos[settledIndex];
    if (!current) return;
    const mediaId = watchEngineMediaId(current);
    engineRef.current.applyResolvedSource(
      resolveWatchEngineItemSource({
        mediaId,
        src: current.src,
      })
    );
  }, [mediaIds, settledIndex, videos]);

  const applyEngineState = useCallback(() => {
    const state = engineRef.current.getState();
    setAudioOwner(state.audioOwner);
    if (state.gesturePhase === "idle" && state.settledIndex !== settledRef.current) {
      onSettledIndex(state.settledIndex);
    }
  }, [onSettledIndex]);

  const finishSnap = useCallback(
    (offset: number) => {
      snappingRef.current = false;
      snapping.value = false;
      lastOffsetRef.current = offset;
      const { effects } = engineRef.current.nativeSettled({
        offset,
        itemHeight: itemHeightRef.current,
      });
      if (effects.snap != null) return;
      applyEngineState();
    },
    [applyEngineState, snapping]
  );

  useAnimatedReaction(
    () => snapOffset.value,
    (value) => {
      if (!snapping.value) return;
      scrollTo(listRef, 0, value, false);
    }
  );

  const snapOnce = useCallback(
    (index: number) => {
      const target = resolveWatchEngineSnapOffset({
        index,
        itemHeight: itemHeightRef.current,
      });
      if (target == null) return;
      const from = lastOffsetRef.current;
      if (Math.abs(target - from) < 1) {
        finishSnap(target);
        return;
      }
      cancelAnimation(snapOffset);
      snappingRef.current = true;
      snapping.value = true;
      snapOffset.value = from;
      snapOffset.value = withTiming(
        target,
        {
          duration: resolveWatchEngineSnapDurationMs(),
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished) {
            runOnJS(finishSnap)(target);
          }
        }
      );
    },
    [finishSnap, snapOffset, snapping]
  );

  useImperativeHandle(ref, () => ({ snapToIndex: snapOnce }), [snapOnce]);

  const onScrollBeginDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      cancelAnimation(snapOffset);
      snappingRef.current = false;
      snapping.value = false;
      const offset = event.nativeEvent.contentOffset.y;
      lastOffsetRef.current = offset;
      dragStartOffsetRef.current = offset;
      dragStartIndexRef.current = settledRef.current;
      engineRef.current.beginGesture(settledRef.current);
    },
    [snapOffset, snapping]
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.y;
      lastOffsetRef.current = offset;
      if (!(itemHeightRef.current > 0)) return;
      const visible = Math.round(offset / itemHeightRef.current);
      engineRef.current.moveGesture(visible);
    },
    []
  );

  const onScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      lastOffsetRef.current = event.nativeEvent.contentOffset.y;
      const { state, effects } = engineRef.current.releaseGesture({
        fromIndex: dragStartIndexRef.current,
        currentOffset: event.nativeEvent.contentOffset.y,
        dragStartOffset: dragStartOffsetRef.current,
        itemHeight: itemHeightRef.current,
        velocityY: event.nativeEvent.velocity?.y,
      });
      snapGenRef.current = state.snapGeneration;
      if (effects.snap) {
        snapOnce(effects.snap.index);
      }
      applyEngineState();
    },
    [applyEngineState, snapOnce]
  );

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (snappingRef.current) return;
      lastOffsetRef.current = event.nativeEvent.contentOffset.y;
      const { effects } = engineRef.current.nativeSettled({
        offset: event.nativeEvent.contentOffset.y,
        itemHeight: itemHeightRef.current,
      });
      if (effects.snap != null) return;
      applyEngineState();
    },
    [applyEngineState]
  );

  const slots = useMemo(
    () =>
      planWatchEnginePlayerSlots({
        settledIndex,
        itemCount: videos.length,
        direction: engineRef.current.getState().direction,
      }),
    [settledIndex, videos.length]
  );

  const emitReadiness = useCallback(
    (
      mediaId: string,
      flags: {
        sourcePlayable: boolean;
        surfaceAttached: boolean;
        firstFrameReady: boolean;
      }
    ) => {
      onReadiness?.({
        mediaId,
        readiness: resolveWatchEngineReadiness(flags),
      });
    },
    [onReadiness]
  );

  useEffect(() => {
    const current = videos[settledIndex];
    if (!current) return;
    const mediaId = watchEngineMediaId(current);
    const playable =
      watchEngineItemSourceUri({ mediaId, src: current.src }) != null;
    emitReadiness(mediaId, {
      sourcePlayable: playable,
      surfaceAttached: Boolean(surfaceReadyById[mediaId]),
      firstFrameReady: Boolean(firstFrameById[mediaId]),
    });
  }, [emitReadiness, firstFrameById, settledIndex, surfaceReadyById, videos]);

  useEffect(() => {
    if (
      shouldRequestWatchEngineFeedTail({
        settledIndex,
        itemCount: videos.length,
        hasMore,
        loadingMore,
      })
    ) {
      onRequestMore();
    }
  }, [hasMore, loadingMore, onRequestMore, settledIndex, videos.length]);

  const renderItem = useCallback(
    ({ item, index }: { item: WatchVideo; index: number }) => {
      const mediaId = watchEngineMediaId(item);
      const mount = shouldMountWatchEnginePlayer({ index, slots });
      const isCurrent = index === slots.current;
      const resolvedSrc = watchEngineItemSourceUri({
        mediaId,
        src: item.src,
      });
      const playable = resolvedSrc != null;
      const previousIdentity = playerIdentityRef.current;
      const recreate =
        isCurrent &&
        playable &&
        shouldRecreateWatchEnginePlayer({
          previousMediaId: previousIdentity?.mediaId,
          nextMediaId: mediaId,
          previousSrc: previousIdentity?.src,
          nextSrc: resolvedSrc ?? "",
        });
      if (isCurrent && playable && resolvedSrc && (recreate || !previousIdentity)) {
        playerIdentityRef.current = { mediaId, src: resolvedSrc };
      }
      const wantsPlay = resolveWatchEngineWantsPlay({
        isCurrent,
        screenFocused,
        userPaused: userPaused && isCurrent,
      });
      const audible = audioOwner === mediaId && isCurrent && wantsPlay;
      return (
        <View style={{ height: itemHeight, backgroundColor: "#000" }}>
          {mount && playable && resolvedSrc ? (
            <WatchEnginePlayer
              key={mediaId}
              src={resolvedSrc}
              mediaId={mediaId}
              shouldPlay={wantsPlay}
              audible={audible}
              muted={muted}
              volume={volume}
              seekRequest={
                isCurrent && seekRequest?.mediaId === mediaId
                  ? seekRequest
                  : null
              }
              onSurfaceReady={(id) => {
                engineRef.current.markSurfaceReady(id);
                setSurfaceReadyById((prev) =>
                  prev[id] ? prev : { ...prev, [id]: true }
                );
                emitReadiness(id, {
                  sourcePlayable: true,
                  surfaceAttached: true,
                  firstFrameReady: Boolean(firstFrameById[id]),
                });
                applyEngineState();
              }}
              onFirstFrame={(id) => {
                engineRef.current.markFirstFrame(id);
                setFirstFrameById((prev) =>
                  prev[id] ? prev : { ...prev, [id]: true }
                );
                emitReadiness(id, {
                  sourcePlayable: true,
                  surfaceAttached: true,
                  firstFrameReady: true,
                });
                applyEngineState();
              }}
              onTimeline={(id, next) => {
                if (!isCurrent) return;
                timelineStoreRef.current.set(id, next);
              }}
              onEnded={() => {
                if (isCurrent) onActiveEnded();
              }}
            />
          ) : null}
          <WatchEngineChromeBridge
            mediaId={mediaId}
            store={timelineStoreRef.current}
            item={item}
            index={index}
            isActive={isCurrent}
            onUserPausedChange={isCurrent ? setUserPaused : undefined}
            onSeekRatio={isCurrent ? onSeekRatio : undefined}
            renderChrome={renderChrome}
          />
        </View>
      );
    },
    [
      applyEngineState,
      audioOwner,
      itemHeight,
      muted,
      onActiveEnded,
      renderChrome,
      emitReadiness,
      firstFrameById,
      onSeekRatio,
      screenFocused,
      seekRequest,
      slots,
      userPaused,
      volume,
    ]
  );

  return (
    <Animated.FlatList
      ref={listRef}
      data={videos}
      keyExtractor={(item) => watchEngineMediaId(item)}
      renderItem={renderItem}
      pagingEnabled={false}
      scrollEnabled={listScrollEnabled}
      showsVerticalScrollIndicator={false}
      disableIntervalMomentum
      decelerationRate="fast"
      getItemLayout={(_, index) => ({
        length: itemHeight,
        offset: itemHeight * index,
        index,
      })}
      onScroll={onScroll}
      onScrollBeginDrag={onScrollBeginDrag}
      onScrollEndDrag={onScrollEndDrag}
      onMomentumScrollEnd={onMomentumScrollEnd}
      scrollEventThrottle={16}
      onEndReached={onRequestMore}
      onEndReachedThreshold={0.6}
      extraData={`${extraData ?? ""}:${watchEngineSrcSignature(videos)}:${Object.keys(firstFrameById).length}:${userPaused ? "1" : "0"}`}
      windowSize={5}
      maxToRenderPerBatch={3}
      initialNumToRender={2}
      removeClippedSubviews={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          enabled={settledIndex === 0}
          tintColor={colors.accentCyan}
          colors={[colors.accentCyan]}
        />
      }
      ListFooterComponent={listFooter ? <>{listFooter}</> : null}
    />
  );
});
