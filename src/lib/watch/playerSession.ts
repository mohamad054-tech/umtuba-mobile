/**
 * Imperative playback intent applied to an expo-video player-like object.
 * Kept framework-light so unit tests can verify play/pause/cleanup contracts
 * without mounting native views.
 *
 * expo-video VideoPlayer is a SharedObject. After useReleasingSharedObject
 * calls release(), play/pause/mute/loop/seek throw. Every op must no-op.
 */
export type PlayerLike = {
  play: () => void;
  pause: () => void;
  muted: boolean;
  volume: number;
  loop: boolean;
  currentTime: number;
  duration?: number;
  replay?: () => void;
  replaceAsync?: (src: string) => Promise<unknown>;
  /** Present on our test double; native SharedObject throws instead. */
  isReleased?: boolean;
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

export function isPlayerAlive(
  player: PlayerLike | null | undefined
): boolean {
  if (player == null) return false;
  if (player.isReleased === true) return false;
  try {
    void player.muted;
    return true;
  } catch {
    return false;
  }
}

/**
 * Run a player mutation only when the SharedObject is still bound.
 * Never throws to JS after native release.
 */
export function runAlivePlayerOp(
  player: PlayerLike | null | undefined,
  op: (alive: PlayerLike) => void
): boolean {
  if (!isPlayerAlive(player) || player == null) return false;
  try {
    op(player);
    return isPlayerAlive(player);
  } catch {
    return false;
  }
}

/**
 * Silence + stop. Mute and disable loop BEFORE pause so a native
 * play-to-end handler cannot restart audio. Seek-to-0 can resume
 * AVPlayer; pause again after reset.
 *
 * No-ops if the SharedObject is already released.
 */
export function applyInactiveAudioTeardown(
  player: PlayerLike,
  options?: { resetPosition?: boolean }
): boolean {
  return runAlivePlayerOp(player, (alive) => {
    alive.muted = true;
    alive.volume = 0;
    alive.loop = false;
    alive.pause();
    if (options?.resetPosition) {
      alive.currentTime = 0;
      alive.pause();
    }
  });
}

export function applyPlaybackIntent(
  player: PlayerLike,
  intent: PlaybackIntent
): boolean {
  if (!isPlayerAlive(player)) return false;
  if (!intent.shouldPlay) {
    return applyInactiveAudioTeardown(player, {
      resetPosition: intent.resetPosition === true,
    });
  }
  return runAlivePlayerOp(player, (alive) => {
    alive.muted = intent.muted;
    alive.volume = intent.volume;
    alive.loop = intent.loop;
    alive.play();
  });
}

export function applySeekTime(player: PlayerLike, seconds: number): boolean {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return false;
  }
  return runAlivePlayerOp(player, (alive) => {
    alive.currentTime = seconds;
  });
}

/** Mark a session cleaned up (mirrors unmount release expectations). */
export function createPlayerSession() {
  let released = false;
  let muted = false;
  let volume = 1;
  let loop = false;
  let currentTime = 0;
  const calls: string[] = [];

  const assertAlive = (op: string) => {
    if (released) throw new Error(`${op} after release`);
  };

  const player: PlayerLike = {
    get isReleased() {
      return released;
    },
    get muted() {
      assertAlive("muted");
      return muted;
    },
    set muted(value) {
      assertAlive("mute");
      muted = value;
    },
    get volume() {
      assertAlive("volume");
      return volume;
    },
    set volume(value) {
      assertAlive("volume");
      volume = value;
    },
    get loop() {
      assertAlive("loop");
      return loop;
    },
    set loop(value) {
      assertAlive("loop");
      loop = value;
    },
    get currentTime() {
      assertAlive("seek");
      return currentTime;
    },
    set currentTime(value) {
      assertAlive("seek");
      currentTime = value;
    },
    play: () => {
      assertAlive("play");
      calls.push("play");
    },
    pause: () => {
      assertAlive("pause");
      calls.push("pause");
    },
    replay: () => {
      assertAlive("replay");
      calls.push("replay");
      currentTime = 0;
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
