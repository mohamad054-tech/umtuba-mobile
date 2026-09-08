export type WatchEngineAudioDecision = {
  owner: string | null;
  silence: string[];
};

/**
 * Exactly one audible owner. Outgoing is silent before incoming becomes audible.
 */
export function resolveWatchEngineAudioOwner(input: {
  settledMediaId: string | null;
  incomingMediaId: string | null;
  incomingFirstFrame: boolean;
  gesturePhase: "idle" | "dragging" | "settling";
  mountedMediaIds: string[];
}): WatchEngineAudioDecision {
  const mounted = input.mountedMediaIds.filter(Boolean);
  const incoming = input.incomingMediaId;
  const settled = input.settledMediaId;

  if (input.gesturePhase === "dragging") {
    return {
      owner: settled,
      silence: mounted.filter((id) => id !== settled),
    };
  }

  if (input.gesturePhase === "settling") {
    if (!incoming || !input.incomingFirstFrame) {
      return { owner: null, silence: mounted };
    }
    return {
      owner: incoming,
      silence: mounted.filter((id) => id !== incoming),
    };
  }

  if (!settled) {
    return { owner: null, silence: mounted };
  }
  return {
    owner: settled,
    silence: mounted.filter((id) => id !== settled),
  };
}

export function watchEngineAudioOwnerCount(
  decision: WatchEngineAudioDecision
): number {
  return decision.owner ? 1 : 0;
}
