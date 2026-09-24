import { DEFAULT_DURATION_MS, DEFAULT_SETTINGS, TimerSettings } from "./types";

const KEY = "timetimr:v1";

interface Persisted {
  settings: TimerSettings;
  durationMs: number;
}

export function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { settings: DEFAULT_SETTINGS, durationMs: DEFAULT_DURATION_MS };
    const parsed = JSON.parse(raw);
    return {
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      durationMs: typeof parsed.durationMs === "number" ? parsed.durationMs : DEFAULT_DURATION_MS,
    };
  } catch {
    return { settings: DEFAULT_SETTINGS, durationMs: DEFAULT_DURATION_MS };
  }
}

export function savePersisted(settings: TimerSettings, durationMs: number): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ settings, durationMs }));
  } catch {
    // storage unavailable (e.g. private mode) — fail silently, app still works in-memory
  }
}
