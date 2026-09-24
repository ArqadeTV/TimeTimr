let ctx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Short pleasant chime, synthesized — no audio asset files required. */
export function playChime(volume: number): void {
  const audioCtx = getContext();
  const now = audioCtx.currentTime;
  const notes = [880, 1108.73, 1318.51]; // A5, C#6, E6
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = now + i * 0.14;
    const end = start + 0.5;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, volume), start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(start);
    osc.stop(end + 0.05);
  });
}

/** Soft tick, used for the optional per-second ticking sound while running. */
export function playTick(volume: number): void {
  const audioCtx = getContext();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "square";
  osc.frequency.value = 1800;
  gain.gain.setValueAtTime(Math.max(0.0001, volume * 0.15), now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.05);
}
