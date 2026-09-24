import { Bridge } from "../core/bridge";
import { playChime, playTick } from "../core/sound";
import { createInitialState, tick, toggleStartPause, reset as resetTimer } from "../core/timer";
import { TimerState, WidgetKind } from "../core/types";
import { TimerClock } from "./clock";
import { TimerDisk } from "./disk";

export class PopoutApp {
  private bridge: Bridge;
  private kind: WidgetKind;
  private state: TimerState | null = null;
  private disk: TimerDisk | null = null;
  private clock: TimerClock | null = null;
  private lastAlarmSeqHandled = 0;
  private lastTickSecond = -1;
  private rafId = 0;
  private startPauseBtn!: HTMLButtonElement;

  constructor(root: HTMLElement, bridge: Bridge, kind: WidgetKind) {
    this.bridge = bridge;
    this.kind = kind;

    root.innerHTML = `
      <div class="popout-layout" data-kind="${kind}">
        <div class="popout-widget" data-widget-slot></div>
        <div class="popout-controls" data-controls></div>
      </div>
    `;

    const widgetSlot = root.querySelector<HTMLDivElement>("[data-widget-slot]")!;
    const controls = root.querySelector<HTMLDivElement>("[data-controls]")!;

    if (kind === "timer") {
      this.disk = new TimerDisk();
      this.disk.mount(widgetSlot);
      controls.innerHTML = `
        <button data-a="start-pause" type="button" class="btn-primary">Start</button>
        <button data-a="reset" type="button">Reset</button>
        <button data-a="pop-in" type="button" class="btn-subtle">Pop back in</button>
      `;
      this.startPauseBtn = controls.querySelector("[data-a=start-pause]")!;
      this.startPauseBtn.addEventListener("click", () => {
        if (!this.state) return;
        this.broadcast(toggleStartPause(this.state));
      });
      controls.querySelector("[data-a=reset]")!.addEventListener("click", () => {
        if (!this.state) return;
        this.broadcast(resetTimer(this.state));
      });
    } else {
      this.clock = new TimerClock();
      this.clock.mount(widgetSlot);
      controls.innerHTML = `<button data-a="pop-in" type="button" class="btn-subtle">Pop back in</button>`;
    }

    controls.querySelector("[data-a=pop-in]")!.addEventListener("click", () => this.popBackIn());
    window.addEventListener("beforeunload", () => this.notifyClosed());

    this.bridge.onMessage((msg) => {
      if (msg.type === "state") this.applyState(msg.state);
    });
    this.bridge.send({ type: "request-state" });

    document.title = kind === "timer" ? "TimeTimr — Timer" : "TimeTimr — Clock";
    this.loop();
  }

  private applyState(state: TimerState): void {
    const first = this.state === null;
    this.state = state;
    if (first) this.lastAlarmSeqHandled = state.alarmSeq;
    if (this.disk) this.disk.update(state);
    if (this.clock) this.clock.applySettings(state.settings);
    if (this.startPauseBtn) {
      this.startPauseBtn.textContent = state.status === "running" ? "Pause" : "Start";
    }
  }

  private broadcast(next: TimerState): void {
    this.state = next;
    this.bridge.send({ type: "state", state: next });
  }

  private popBackIn(): void {
    this.notifyClosed();
    this.bridge.closeSelf();
  }

  private notifyClosed(): void {
    this.bridge.send({ type: "popout-status", status: { [this.kind]: false } });
  }

  private loop = (): void => {
    const now = Date.now();
    if (this.state) {
      const next = tick(this.state, now);
      if (next !== this.state) {
        this.state = next;
        this.bridge.send({ type: "state", state: this.state });
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
  }
}

// Fallback state used only until the first real state arrives (keeps SSR-less
// popout window from rendering blank if opened before the main window responds).
export function placeholderState() {
  return createInitialState();
}
