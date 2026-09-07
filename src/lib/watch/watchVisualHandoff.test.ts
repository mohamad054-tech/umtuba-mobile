import { describe, expect, it } from "vitest";

import {
  shouldAttachPreparedNeighborSurface,
  shouldExposeWatchTargetSurface,
  shouldHandoffWatchVisualImmediately,
  shouldRetainOutgoingWatchVisual,
} from "./watchVisualHandoff";

describe("Watch rapid visual handoff", () => {
  it("pre-attaches a prepared Android neighbor so first_frame can finish off-screen", () => {
    expect(
      shouldAttachPreparedNeighborSurface({
        platform: "android",
        preparePlayer: true,
        itemReady: true,
        isNeighbor: true,
      })
    ).toBe(true);
    expect(
      shouldAttachPreparedNeighborSurface({
        platform: "android",
        preparePlayer: true,
        itemReady: false,
        isNeighbor: true,
      })
    ).toBe(false);
    expect(
      shouldAttachPreparedNeighborSurface({
        platform: "android",
        preparePlayer: true,
        itemReady: true,
        isNeighbor: false,
      })
    ).toBe(false);
    expect(
      shouldAttachPreparedNeighborSurface({
        platform: "ios",
        preparePlayer: true,
        itemReady: true,
        isNeighbor: true,
      })
    ).toBe(false);
  });

  it("never exposes a non-active target before a drawable first frame", () => {
    expect(
      shouldExposeWatchTargetSurface({
        isActive: false,
        attached: true,
        firstFrameDrawable: false,
      })
    ).toBe(false);
    expect(
      shouldExposeWatchTargetSurface({
        isActive: false,
        attached: true,
        firstFrameDrawable: true,
      })
    ).toBe(true);
    expect(
      shouldExposeWatchTargetSurface({
        isActive: true,
        attached: true,
        firstFrameDrawable: false,
      })
    ).toBe(true);
    expect(
      shouldExposeWatchTargetSurface({
        isActive: false,
        attached: false,
        firstFrameDrawable: true,
      })
    ).toBe(false);
  });

  it("keeps outgoing visual continuity until the target first frame is drawable", () => {
    expect(
      shouldRetainOutgoingWatchVisual({
        targetIndex: 4,
        targetFirstFrameDrawable: false,
      })
    ).toBe(true);
    expect(
      shouldRetainOutgoingWatchVisual({
        targetIndex: 4,
        targetFirstFrameDrawable: true,
      })
    ).toBe(false);
    expect(
      shouldRetainOutgoingWatchVisual({
        targetIndex: null,
        targetFirstFrameDrawable: false,
      })
    ).toBe(false);
  });

  it("handoffs immediately once the target first frame is drawable", () => {
    expect(
      shouldHandoffWatchVisualImmediately({ targetFirstFrameDrawable: false })
    ).toBe(false);
    expect(
      shouldHandoffWatchVisualImmediately({ targetFirstFrameDrawable: true })
    ).toBe(true);
  });
});
