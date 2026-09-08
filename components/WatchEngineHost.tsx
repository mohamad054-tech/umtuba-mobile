import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  FlatList,
  RefreshControl,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import type { WatchVideo } from "@/src/contracts/watch";
import {
  createWatchPlaybackController,
  planWatchEnginePlayerSlots,
  resolveWatchEngineItemSource,
  resolveWatchEngineReadiness,
  shouldMountWatchEnginePlayer,
  shouldRecreateWatchEnginePlayer,
  shouldRequestWatchEngineFeedTail,
  watchEngineItemSourceUri,
  watchEngineMediaId,
  watchEngineOffsetForIndex,
  watchEngineSrcSignature,
  WatchEnginePlayer,
  type WatchEngineReadiness,
  type WatchEngineTimeline,
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
  }) => ReactNode;
};

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
  const listRef = useRef<FlatList<WatchVideo>>(null);
  const engineRef = useRef(createWatchPlaybackController());
  const dragStartOffsetRef = useRef(0);
  const dragStartIndexRef = useRef(0);
  const itemHeightRef = useRef(itemHeight);
  const settledRef = useRef(settledIndex);
  const snapGenRef = useRef(0);
  const [audioOwner, setAudioOwner] = useState<string | null>(null);
  const [firstFrameById, setFirstFrameById] = useState<Record<string, boolean>>(
    {}
  );
  const [surfaceReadyById, setSurfaceReadyById] = useState<
    Record<string, boolean>
  >({});
  const [timelineById, setTimelineById] = useState<
    Record<string, WatchEngineTimeline>
  >({});
  const playerIdentityRef = useRef<{ mediaId: string; src: string } | null>(
    null
  );

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

  const snapOnce = useCallback((index: number) => {
    const offset = watchEngineOffsetForIndex(index, itemHeightRef.current);
    if (offset == null) return;
    listRef.current?.scrollToOffset({ offset, animated: true });
  }, []);

  useImperativeHandle(ref, () => ({ snapToIndex: snapOnce }), [snapOnce]);

  const applyEngineState = useCallback(() => {
    const state = engineRef.current.getState();
    setAudioOwner(state.audioOwner);
    if (state.gesturePhase === "idle" && state.settledIndex !== settledRef.current) {
      onSettledIndex(state.settledIndex);
    }
  }, [onSettledIndex]);

  const onScrollBeginDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      dragStartOffsetRef.current = event.nativeEvent.contentOffset.y;
      dragStartIndexRef.current = settledRef.current;
      engineRef.current.beginGesture(settledRef.current);
    },
    []
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.y;
      if (!(itemHeightRef.current > 0)) return;
      const visible = Math.round(offset / itemHeightRef.current);
      engineRef.current.moveGesture(visible);
    },
    []
  );

  const onScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
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
      const audible = audioOwner === mediaId && isCurrent;
      return (
        <View style={{ height: itemHeight, backgroundColor: "#000" }}>
          {mount && playable && resolvedSrc ? (
            <WatchEnginePlayer
              key={mediaId}
              src={resolvedSrc}
              mediaId={mediaId}
              shouldPlay={isCurrent && screenFocused}
              audible={audible}
              muted={muted}
              volume={volume}
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
                setTimelineById((prev) => {
                  const current = prev[id];
                  if (
                    current &&
                    current.duration === next.duration &&
                    Math.abs(current.currentTime - next.currentTime) < 0.2
                  ) {
                    return prev;
                  }
                  return { ...prev, [id]: next };
                });
              }}
              onEnded={() => {
                if (isCurrent) onActiveEnded();
              }}
            />
          ) : null}
          {renderChrome({
            item,
            index,
            isActive: isCurrent,
            timeline: timelineById[mediaId] ?? null,
          })}
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
      screenFocused,
      slots,
      timelineById,
      volume,
    ]
  );

  return (
    <FlatList
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
      extraData={`${extraData ?? ""}:${watchEngineSrcSignature(videos)}:${Object.keys(firstFrameById).length}`}
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
