export type ClockStyle = "analog" | "digital" | "both";
export type ClockPosition = "left" | "right" | "above" | "below";
export type WidgetKind = "timer" | "clock";

export interface TimerSettings {
  diskColor: string;
  diskBackground: string;
  faceColor: string;
  textColor: string;
  showDigitalReadout: boolean;
  showTickMarks: boolean;
  dragToSet: boolean;
  showClock: boolean;
  clockStyle: ClockStyle;
  clockPosition: ClockPosition;
  use24Hour: boolean;
  playSoundAtEnd: boolean;
  tickSound: boolean;
  volume: number; // 0..1
  alwaysOnTopPopouts: boolean; // Electron popout windows only
}

export type TimerStatus = "idle" | "running" | "paused" | "finished";

export interface TimerState {
  status: TimerStatus;
  /** Total duration the disk represents, in milliseconds. */
  durationMs: number;
  /** Remaining time, valid when status is idle/paused/finished. */
  remainingMs: number;
  /** epoch ms the timer will hit zero at; set only while running. */
  endTimestamp: number | null;
  /** Increments every time the alarm should fire; used for edge detection across windows. */
  alarmSeq: number;
  settings: TimerSettings;
}

export interface PopoutStatus {
  timer: boolean;
  clock: boolean;
}

export type BridgeMessage =
  | { type: "state"; state: TimerState }
  | { type: "request-state" }
  | { type: "popout-status"; status: Partial<PopoutStatus> };

export const DEFAULT_SETTINGS: TimerSettings = {
  diskColor: "#e6432b",
  diskBackground: "#fbeee9",
  faceColor: "#ffffff",
  textColor: "#2b2b2b",
  showDigitalReadout: true,
  showTickMarks: true,
  dragToSet: true,
  showClock: false,
  clockStyle: "analog",
  clockPosition: "right",
  use24Hour: false,
  playSoundAtEnd: true,
  tickSound: false,
  volume: 0.6,
  alwaysOnTopPopouts: false,
};

export const DEFAULT_DURATION_MS = 5 * 60 * 1000;
