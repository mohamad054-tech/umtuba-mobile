/**
 * Imperative playback intent applied to an expo-video player-like object.
 * Kept framework-light so unit tests can verify play/pause/cleanup contracts
 * without mounting native views.
 */
export type PlayerLike = {
  play: () => void;
  pause: () => void;
  muted: boolean;
  volume: number;
  loop: boolean;
  currentTime: number;
  replay?: () => void;
};

export type PlaybackIntent = {
  shouldPlay: boolean;
  muted: boolean;
  /** VideoPlayer.volume in 0–1 (in-app, not system volume). */
  volume: number;
  /** When true, replay current clip at end; when false, emit playToEnd for auto-next. */
  loop: boolean;
  /** Seek to start when pausing an inactive (off-screen) card. */
  resetPosition?: boolean;
};

export function applyPlaybackIntent(
  player: PlayerLike,
  intent: PlaybackIntent
): void {
  player.muted = intent.muted;
  player.volume = intent.volume;
  player.loop = intent.loop;
  if (intent.shouldPlay) {
    player.play();
  } else {
    player.pause();
    if (intent.resetPosition) {
      player.currentTime = 0;
    }
  }
}

export function applySeekTime(player: PlayerLike, seconds: number): boolean {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return false;
  }
  player.currentTime = seconds;
  return true;
}

/** Mark a session cleaned up (mirrors unmount release expectations). */
export function createPlayerSession() {
  let released = false;
  const calls: string[] = [];
  const player: PlayerLike = {
    muted: false,
    volume: 1,
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
    replay: () => {
      if (released) throw new Error("replay after release");
      calls.push("replay");
      player.currentTime = 0;
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
