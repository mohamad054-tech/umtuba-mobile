/**
 * Imperative playback intent applied to an expo-video player-like object.
 * Kept framework-light so unit tests can verify play/pause/cleanup contracts
 * without mounting native views.
 */
export type PlayerLike = {
  play: () => void;
  pause: () => void;
  muted: boolean;
  loop: boolean;
  currentTime: number;
  replay?: () => void;
};

export type PlaybackIntent = {
  shouldPlay: boolean;
  muted: boolean;
  /** Seek to start when pausing an inactive (off-screen) card. */
  resetPosition?: boolean;
};

export function applyPlaybackIntent(
  player: PlayerLike,
  intent: PlaybackIntent
): void {
  player.muted = intent.muted;
  player.loop = true;
  if (intent.shouldPlay) {
    player.play();
  } else {
    player.pause();
    if (intent.resetPosition) {
      player.currentTime = 0;
    }
  }
}

/** Mark a session cleaned up (mirrors unmount release expectations). */
export function createPlayerSession() {
  let released = false;
  const calls: string[] = [];
  const player: PlayerLike = {
    muted: true,
    loop: false,
    currentTime: 0,
    play: () => {
      if (released) throw new Error("play after release");
      calls.push("play");
    },
    pause: () => {
      if (released) throw new Error("pause after release");
      calls.push("pause");
    },
  };
  return {
    player,
    calls,
    release: () => {
      if (released) return;
      calls.push("release");
      try {
        player.pause();
      } finally {
        released = true;
      }
    },
    get released() {
      return released;
    },
  };
}
