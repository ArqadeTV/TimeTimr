import { Bridge } from "../core/bridge";
import { MOVE_BEFORE_DOCK_TRACKING_PX } from "../core/dock";
import { playChime, playTick } from "../core/sound";
import {
  createInitialState,
  getRemainingMs,
  msToParts,
  reset as resetTimer,
  setDurationParts,
  tick,
  toggleStartPause,
} from "../core/timer";
import { TimerState, WidgetKind } from "../core/types";
import { TimerClock } from "./clock";
import { TimerDisk } from "./disk";

export interface PopoutAppOptions {
  /** The real window this content lives in. Defaults to `window` — pass the Picture-in-Picture
   *  window here when hosting the widget inside one, since this runs in the opener's JS realm
   *  and `window` itself never changes. Used for title/focus-state and drag-dock bounds. */
  hostWindow?: Window;
  /** Called instead of `bridge.closeSelf()` when the user clicks "Pop back in". Needed for a
   *  PiP-hosted widget, where closing means `hostWindow.close()`, not the main tab. */
  onCloseRequested?: () => void;
  /** Whether to poll and report this window's position for drag-to-dock detection. Off by
   *  default for a PiP window — it isn't meant to dock with anything else. */
  trackBounds?: boolean;
}

export class PopoutApp {
  private bridge: Bridge;
  private kind: WidgetKind;
  private hostWindow: Window;
  private onCloseRequested?: () => void;
  private trackBounds: boolean;
  private state: TimerState | null = null;
  private disk: TimerDisk | null = null;
  private clock: TimerClock | null = null;
  private lastAlarmSeqHandled = 0;
  private lastTickSecond = -1;
  private rafId = 0;
  private boundsIntervalId = 0;
  private spawnBounds: { x: number; y: number } | null = null;
  private startPauseBtn!: HTMLButtonElement;
  private hInput!: HTMLInputElement;
  private mInput!: HTMLInputElement;
  private sInput!: HTMLInputElement;

  constructor(root: HTMLElement, bridge: Bridge, kind: WidgetKind, options: PopoutAppOptions = {}) {
    this.bridge = bridge;
    this.kind = kind;
    this.hostWindow = options.hostWindow ?? window;
    this.onCloseRequested = options.onCloseRequested;
    this.trackBounds = options.trackBounds ?? true;

    root.innerHTML = `
      <div class="popout-layout" data-kind="${kind}">
        <div class="popout-widget" data-widget-slot></div>
        <div class="popout-controls" data-controls></div>
      </div>
    `;

    const widgetSlot = root.querySelector<HTMLDivElement>("[data-widget-slot]")!;
    const controls = root.querySelector<HTMLDivElement>("[data-controls]")!;

    const showsTimer = kind === "timer" || kind === "combined";
    const showsClock = kind === "clock" || kind === "combined";

    if (showsTimer) {
      this.disk = new TimerDisk();
      this.disk.mount(widgetSlot);
    }
    if (showsClock) {
      this.clock = new TimerClock();
      this.clock.mount(widgetSlot);
    }

    controls.innerHTML = `
      ${
        showsTimer
          ? `<div class="duration-row">
               <label>Hr <input data-f="h" type="number" min="0" max="23" value="0" inputmode="numeric" /></label>
               <label>Min <input data-f="m" type="number" min="0" max="59" value="0" inputmode="numeric" /></label>
               <label>Sec <input data-f="s" type="number" min="0" max="59" value="0" inputmode="numeric" /></label>
               <button data-a="apply-duration" type="button">Set</button>
             </div>`
          : ""
      }
      <div class="transport-row">
        ${showsTimer ? '<button data-a="start-pause" type="button" class="btn-primary">Start</button>' : ""}
        ${showsTimer ? '<button data-a="reset" type="button">Reset</button>' : ""}
        <button data-a="pop-in" type="button" class="btn-subtle">Pop back in</button>
      </div>
    `;
    if (showsTimer) {
      this.hInput = controls.querySelector("[data-f=h]")!;
      this.mInput = controls.querySelector("[data-f=m]")!;
      this.sInput = controls.querySelector("[data-f=s]")!;
      this.startPauseBtn = controls.querySelector("[data-a=start-pause]")!;
      this.startPauseBtn.addEventListener("click", () => {
        if (!this.state) return;
        this.broadcast(toggleStartPause(this.state));
      });
      controls.querySelector("[data-a=reset]")!.addEventListener("click", () => {
        if (!this.state) return;
        this.broadcast(resetTimer(this.state));
      });
      controls.querySelector("[data-a=apply-duration]")!.addEventListener("click", () => {
        if (!this.state) return;
        this.broadcast(setDurationParts(this.state, this.numOf(this.hInput), this.numOf(this.mInput), this.numOf(this.sInput)));
      });
    }

    controls.querySelector("[data-a=pop-in]")!.addEventListener("click", () => this.popBackIn());
    // The whole tab/app closing always matters, regardless of what's hosting this widget.
    window.addEventListener("beforeunload", () => this.notifyClosed());

    this.bridge.onMessage((msg) => {
      if (msg.type === "state") {
        this.applyState(msg.state);
      } else if (msg.type === "close-popout" && msg.kind === this.kind) {
        // The main window asked this specific pop-out to close (e.g. while joining
        // separate pop-outs into one combined window).
        this.popBackIn();
      }
    });
    this.bridge.send({ type: "request-state" });

    root.ownerDocument.title =
      kind === "timer" ? "TimeTimr — Timer" : kind === "clock" ? "TimeTimr — Clock" : "TimeTimr — Timer & Clock";
    this.loop();

    // Electron tracks real window 'move' events itself (see electron/main.cjs); on the
    // web there's no cross-window API for that, so a pop-out instead polls and reports
    // its own screen position, letting the main window detect a drag-to-dock.
    if (bridge.environment === "web" && this.trackBounds) {
      this.boundsIntervalId = window.setInterval(() => this.reportBounds(), 200);
    }
  }

  private reportBounds(): void {
    const w = this.hostWindow;
    const bounds = { x: w.screenX, y: w.screenY, width: w.outerWidth, height: w.outerHeight };
    if (!this.spawnBounds) {
      this.spawnBounds = { x: bounds.x, y: bounds.y };
      return; // don't report the window's default open position — only real drags
    }
    const moved =
      Math.abs(bounds.x - this.spawnBounds.x) > MOVE_BEFORE_DOCK_TRACKING_PX ||
      Math.abs(bounds.y - this.spawnBounds.y) > MOVE_BEFORE_DOCK_TRACKING_PX;
    if (!moved) return;
    this.bridge.send({ type: "popout-bounds", kind: this.kind, bounds });
  }

  private applyState(state: TimerState): void {
    const first = this.state === null;
    this.state = state;
    if (first) this.lastAlarmSeqHandled = state.alarmSeq;
    if (this.disk) this.disk.update(state);
    if (this.clock) this.clock.applySettings(state.settings);
    if (this.startPauseBtn) {
      const running = state.status === "running";
      this.startPauseBtn.textContent = running ? "Pause" : "Start";
      this.hInput.disabled = running;
      this.mInput.disabled = running;
      this.sInput.disabled = running;
      this.syncDurationInputs(getRemainingMs(state));
    }
  }

  private syncDurationInputs(ms: number): void {
    const active = this.hInput.ownerDocument.activeElement;
    if (active === this.hInput || active === this.mInput || active === this.sInput) {
      return; // don't fight the user while they're typing
    }
    const { h, m, s } = msToParts(ms);
    this.hInput.value = String(h);
    this.mInput.value = String(m);
    this.sInput.value = String(s);
  }

  private numOf(input: HTMLInputElement): number {
    const n = Number(input.value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  private broadcast(next: TimerState): void {
    this.state = next;
    this.bridge.send({ type: "state", state: next });
  }

  private popBackIn(): void {
    clearInterval(this.boundsIntervalId);
    this.notifyClosed();
    if (this.onCloseRequested) this.onCloseRequested();
    else this.bridge.closeSelf();
  }

  /** Call when the host window closed on its own (e.g. the user used a Picture-in-Picture
   *  window's native close control, which this code has no "click" event for) — reports
   *  the widget as closed and stops, without trying to close anything itself. */
  notifyClosedExternally(): void {
    clearInterval(this.boundsIntervalId);
    this.notifyClosed();
    this.destroy();
  }

  private notifyClosed(): void {
    const status = this.kind === "combined" ? { timer: false, clock: false, combined: false } : { [this.kind]: false };
    this.bridge.send({ type: "popout-status", status });
  }

  private loop = (): void => {
    const now = Date.now();
    if (this.state) {
      const next = tick(this.state, now);
      if (next !== this.state) {
        this.state = next;
        this.bridge.send({ type: "state", state: this.state });
        if (this.startPauseBtn) {
          this.startPauseBtn.textContent = "Start";
          this.hInput.disabled = false;
          this.mInput.disabled = false;
          this.sInput.disabled = false;
        }
      }
      if (this.state.alarmSeq !== this.lastAlarmSeqHandled) {
        this.lastAlarmSeqHandled = this.state.alarmSeq;
        if (this.state.settings.playSoundAtEnd) playChime(this.state.settings.volume);
      }
      if (this.state.status === "running" && this.state.settings.tickSound) {
        const second = Math.floor(now / 1000);
        if (second !== this.lastTickSecond) {
          this.lastTickSecond = second;
          playTick(this.state.settings.volume);
        }
      }
      if (this.disk) this.disk.update(this.state, now);
    }
    if (this.clock) this.clock.update(new Date(now));
    this.rafId = requestAnimationFrame(this.loop);
  };

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    clearInterval(this.boundsIntervalId);
  }
}

// Fallback state used only until the first real state arrives (keeps SSR-less
// popout window from rendering blank if opened before the main window responds).
export function placeholderState() {
  return createInitialState();
}
