import { DEFAULT_DURATION_MS, DEFAULT_SETTINGS, TimerSettings, TimerState } from "./types";

export function createInitialState(
  settings: Partial<TimerSettings> = {},
  durationMs: number = DEFAULT_DURATION_MS
): TimerState {
  return {
    status: "idle",
    durationMs,
    remainingMs: durationMs,
    endTimestamp: null,
    alarmSeq: 0,
    settings: { ...DEFAULT_SETTINGS, ...settings },
  };
}

/** Remaining ms at a given instant, derived — never stored while running, to avoid drift. */
export function getRemainingMs(state: TimerState, now: number = Date.now()): number {
  if (state.status === "running" && state.endTimestamp !== null) {
    return Math.max(0, state.endTimestamp - now);
  }
  return state.remainingMs;
}

export function start(state: TimerState, now: number = Date.now()): TimerState {
  if (state.status === "running") return state;
  const remaining = getRemainingMs(state, now);
  if (remaining <= 0) return state;
  return {
    ...state,
    status: "running",
    endTimestamp: now + remaining,
  };
}

export function pause(state: TimerState, now: number = Date.now()): TimerState {
  if (state.status !== "running") return state;
  return {
    ...state,
    status: "paused",
    remainingMs: getRemainingMs(state, now),
    endTimestamp: null,
  };
}

export function toggleStartPause(state: TimerState, now: number = Date.now()): TimerState {
  return state.status === "running" ? pause(state, now) : start(state, now);
}

export function reset(state: TimerState): TimerState {
  return {
    ...state,
    status: "idle",
    remainingMs: state.durationMs,
    endTimestamp: null,
  };
}

/** Sets a new duration. Only allowed while not running (mirrors the physical dial). */
export function setDurationMs(state: TimerState, durationMs: number): TimerState {
  const clamped = Math.max(1000, Math.min(durationMs, 1000 * 60 * 60 * 24));
  if (state.status === "running") return state;
  return {
    ...state,
    durationMs: clamped,
    remainingMs: clamped,
    status: "idle",
  };
}

export function setDurationParts(state: TimerState, h: number, m: number, s: number): TimerState {
  const ms = ((h * 60 + m) * 60 + s) * 1000;
  return setDurationMs(state, ms);
}

export function updateSettings(state: TimerState, partial: Partial<TimerSettings>): TimerState {
  return { ...state, settings: { ...state.settings, ...partial } };
}

/** Advances derived status; call this every tick (e.g. via requestAnimationFrame). */
export function tick(state: TimerState, now: number = Date.now()): TimerState {
  if (state.status !== "running" || state.endTimestamp === null) return state;
  const remaining = state.endTimestamp - now;
  if (remaining <= 0) {
    return {
      ...state,
      status: "finished",
      remainingMs: 0,
      endTimestamp: null,
      alarmSeq: state.alarmSeq + 1,
    };
  }
  return state;
}

export function msToParts(ms: number): { h: number; m: number; s: number } {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return { h, m, s };
}

export function formatDuration(ms: number): string {
  const { h, m, s } = msToParts(ms);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
